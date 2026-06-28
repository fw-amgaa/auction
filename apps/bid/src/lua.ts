/**
 * Atomic bid arbitration (ARCHITECTURE.md §6.3). Single-threaded Redis runs this
 * indivisibly, so all concurrent bids on a hot lot serialize for free.
 *
 * KEYS[1] = lot hash key  (lot:{id})
 * ARGV    = userId, nSteps, now(ms), limit
 * Returns reject: {0, reason}
 *         accept: {1, amount, seq, endsAt, extended(0|1), releasedUser, releasedAmount}
 *
 * Committed balances are stored at u:{userId}:committed (single-node Redis, so
 * the script may touch keys outside KEYS[]).
 */
export const BID_LUA = `
local lotKey = KEYS[1]
local userId = ARGV[1]
local nSteps = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

local h = redis.call('HMGET', lotKey, 'price','leader','step','reserve','endsAt','status','hasBids')
if not h[1] then return {0,'closed'} end
local price = tonumber(h[1])
local leader = h[2]
local step = tonumber(h[3])
local reserve = tonumber(h[4])
local endsAt = tonumber(h[5])
local status = h[6]
local hasBids = h[7]

if status ~= 'live' then return {0,'closed'} end
if now > endsAt then return {0,'closed'} end
if leader == userId then return {0,'self'} end
if nSteps < 1 or nSteps > 5 then return {0,'bad_increment'} end

local amount
if hasBids == '1' then
  amount = price + nSteps * step
else
  amount = reserve + (nSteps - 1) * step
end

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
if (endsAt - now) <= 15000 then
  endsAt = endsAt + 30000
  extended = 1
end
redis.call('HSET', lotKey, 'price', amount, 'leader', userId, 'hasBids', '1', 'endsAt', endsAt)
return {1, amount, seq, endsAt, extended, releasedUser, releasedAmount}
`;
