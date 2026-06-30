/**
 * Atomic bid arbitration. Single-threaded Redis runs this indivisibly, so all
 * concurrent bids on a hot lot serialize for free.
 *
 * KEYS[1] = lot hash key  (lot:{id})
 * ARGV    = userId, option(1|2|3|4), now(ms), limit
 * Returns reject: {0, reason}
 *         accept: {1, amount, seq, endsAt, extended(0|1), releasedUser, releasedAmount}
 *
 * Bidding model: two fixed ascending increments per lot (inc1 / inc2). The two
 * MAIN options raise by those increments (1 / 2). In the FINAL STRETCH (last
 * FINAL_STRETCH_SEC) two extra "fast" options unlock that raise by DOUBLE each
 * increment (3 = inc1×2, 4 = inc2×2). The window is checked here against the
 * server clock so it can't be spoofed. A raise adds the chosen increment to the
 * current price; the first bid opens at reserve + increment (price is
 * initialised to the reserve when there are no bids yet, so amount = price + inc
 * handles every case uniformly).
 *
 * Committed balances are stored at u:{userId}:committed (single-node Redis, so
 * the script may touch keys outside KEYS[]).
 *
 * Anti-snipe + final-stretch windows come from @auction/shared (single source of
 * truth) and are interpolated into the script body below as millisecond literals.
 */
import { ANTI_SNIPE_EXTENSION_SEC, ANTI_SNIPE_WINDOW_SEC, FINAL_STRETCH_SEC } from "@auction/shared";

export const BID_LUA = `
local lotKey = KEYS[1]
local userId = ARGV[1]
local option = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

local h = redis.call('HMGET', lotKey, 'price','leader','inc1','inc2','endsAt','status')
if not h[1] then return {0,'closed'} end
local price = tonumber(h[1])
local leader = h[2]
local inc1 = tonumber(h[3])
local inc2 = tonumber(h[4])
local endsAt = tonumber(h[5])
local status = h[6]

if status ~= 'live' then return {0,'closed'} end
if now > endsAt then return {0,'closed'} end
if leader == userId then return {0,'self'} end
if option ~= 1 and option ~= 2 and option ~= 3 and option ~= 4 then return {0,'bad_increment'} end

-- fast (double) options unlock only inside the final stretch
if (option == 3 or option == 4) and (endsAt - now) > ${FINAL_STRETCH_SEC * 1000} then
  return {0,'locked'}
end

local inc
if option == 1 then inc = inc1
elseif option == 2 then inc = inc2
elseif option == 3 then inc = inc1 * 2
else inc = inc2 * 2 end
local amount = price + inc

local ucKey = 'u:'..userId..':committed'
local uc = tonumber(redis.call('GET', ucKey) or '0')
if (uc + amount) > limit then return {0,'insufficient'} end

local releasedUser = ''
local releasedAmount = 0
if leader ~= '' then
  releasedUser = leader
  releasedAmount = price
  local olKey = 'u:'..leader..':committed'
  local olc = tonumber(redis.call('GET', olKey) or '0')
  local nv = olc - price
  if nv < 0 then nv = 0 end
  redis.call('SET', olKey, nv)
end

redis.call('SET', ucKey, uc + amount)
local seq = redis.call('HINCRBY', lotKey, 'seq', 1)
local extended = 0
if (endsAt - now) <= ${ANTI_SNIPE_WINDOW_SEC * 1000} then
  endsAt = endsAt + ${ANTI_SNIPE_EXTENSION_SEC * 1000}
  extended = 1
end
redis.call('HSET', lotKey, 'price', amount, 'leader', userId, 'hasBids', '1', 'endsAt', endsAt)
return {1, amount, seq, endsAt, extended, releasedUser, releasedAmount}
`;
