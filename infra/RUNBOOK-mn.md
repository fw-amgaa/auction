# Улирлын ажиллагааны заавар — системийг асаах / унтраах

Энэ систем **улирлын чанартай**: жилд ~2 сар ажиллаж, үлдсэн хугацаанд зогсдог.
Зорилго нь — дуудлага худалдаа явагдахгүй байх үед AWS-д бараг мөнгө төлөхгүй байх.

> Бүх тушаалыг өөрийн компьютерээс (AWS CLI тохируулсан) ажиллуулна.
> Бүсийг үргэлж `ap-southeast-1` гэж заана.

---

## 1. Одоогийн нөөцүүд

| Юу | ID / нэр | Тайлбар |
|---|---|---|
| EC2 сервер | `i-01ec0aad80bd34eaa` (`t4g.micro`) | caddy + web + bid + redis докер |
| Өгөгдлийн сан | `auction-pg` (`db.t4g.micro`, 20 GB) | RDS PostgreSQL 18.3 — **мөнгөний өгөгдөл** |
| Тогтмол IP | `eipalloc-0bcbf8d00c04602f5` → `47.130.205.214` | DNS үүн рүү заасан |
| Диск | `vol-0351e8f5c46c88234` (30 GB gp3) | |
| Файл хадгалалт | `s3://auction-media-963640736600` | лотын зураг, KYC бичиг |
| Нууц үг/тохиргоо | Secrets Manager `auction/prod` | |
| SSH түлхүүр | `~/.ssh/auction-key.pem` | хэрэглэгч `ec2-user` |

Тохиргооны ID-ууд `infra/.aws-resources` файлд бас байгаа.

---

## 2. СИСТЕМ АСААХ (дуудлага худалдааны өмнө)

### 2.1 Эхлээд өгөгдлийн санг асаана

Өгөгдлийн сан бэлэн болоход **5–10 минут** ордог тул үүнийг хамгийн түрүүнд эхлүүлнэ.

**A) Хэрэв RDS зөвхөн зогссон (stopped) байсан бол:**

```bash
aws rds start-db-instance --region ap-southeast-1 --db-instance-identifier auction-pg
aws rds wait db-instance-available --region ap-southeast-1 --db-instance-identifier auction-pg
```

**B) Хэрэв улирлын төгсгөлд RDS-ийг устгаад снапшот үлдээсэн бол** (3.2-г үзнэ үү):

```bash
# сүүлийн снапшотоо олох
aws rds describe-db-snapshots --region ap-southeast-1 \
  --snapshot-type manual --query 'DBSnapshots[].DBSnapshotIdentifier' --output table

# снапшотоос сэргээх
aws rds restore-db-instance-from-db-snapshot --region ap-southeast-1 \
  --db-instance-identifier auction-pg \
  --db-snapshot-identifier <СНАПШОТЫН-НЭР> \
  --db-instance-class db.t4g.micro \
  --db-subnet-group-name auction-db-subnets \
  --vpc-security-group-ids sg-0e4539f676fae5908 \
  --no-publicly-accessible --no-multi-az

aws rds wait db-instance-available --region ap-southeast-1 --db-instance-identifier auction-pg
```

⚠️ **Сэргээсний дараа хаяг (endpoint) солигдсон эсэхийг заавал шалгана:**

```bash
aws rds describe-db-instances --region ap-southeast-1 \
  --db-instance-identifier auction-pg --query 'DBInstances[0].Endpoint.Address' --output text
```

Хэрэв `auction-pg.cn80qq6k4q80.ap-southeast-1.rds.amazonaws.com` **биш** байвал
Secrets Manager доторх `DATABASE_URL`-г шинэ хаягаар солино. Үгүй бол апп өгөгдлийн санд
холбогдож чадахгүй.

Мөн нөөцлөлтийн хугацааг сэргээсний дараа дахин тавина (сэргээхэд 1 хоног болж унадаг):

```bash
aws rds modify-db-instance --region ap-southeast-1 --db-instance-identifier auction-pg \
  --backup-retention-period 7 --apply-immediately
```

### 2.2 Дараа нь серверийг асаана

```bash
aws ec2 start-instances --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
aws ec2 wait instance-running --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
```

Тогтмол IP (`47.130.205.214`) автоматаар хэвээр үлдэнэ — DNS болон Cloudflare-т юу ч
өөрчлөх шаардлагагүй.

Докер нь ачаалахдаа автоматаар асдаг (`restart: unless-stopped`) тул контейнерууд
өөрөө сэргэнэ. 2–3 минут хүлээгээд шалгана:

```bash
ssh -i ~/.ssh/auction-key.pem ec2-user@47.130.205.214 \
  'sudo docker compose -f ~/auction/infra/docker-compose.prod.yml ps'
```

Бүх контейнер `Up` байх ёстой: `caddy`, `web`, `bid`, `redis`.

### 2.3 Хэрэв контейнер сэргэхгүй бол, эсвэл код шинэчилсэн бол

```bash
DOMAIN=anav.mn bash infra/deploy.sh
```

Энэ нь кодыг сервер рүү хуулж, Secrets Manager-ээс `.env`-г дахин бичиж,
миграц хийж, стекийг дахин босгоно. **Өгөгдлийн сангийн хаяг солигдсон үед үүнийг
заавал ажиллуулна** (шинэ `DATABASE_URL` ингэж л сервер дээр очно).

### 2.4 Ажиллаж байгааг эцэслэн шалгах

```bash
curl -I https://anav.mn
```

`200 OK` ирвэл систем бэлэн. Мөн нэг тест хэрэглэгчээр нэвтэрч, лот нээгдэж
байгааг нүдээр хараарай.

---

## 3. ДУУДЛАГА ХУДАЛДААНЫ ӨДӨР — хүчин чадлыг нэмэх

`t4g.micro` бол зөвхөн 1 GB RAM-тай. **Жинхэнэ дуудлага худалдаанд энэ хүрэлцэхгүй.**
Өмнөх өдөр нь томсгоно (EC2 цагаар тооцдог тул нэг өдөр том сервер ажиллуулах нь
хэдхэн долларын зардал).

```bash
# 1) эхлээд дискний снапшот аваад аюулгүй болгоно
aws ec2 create-snapshot --region ap-southeast-1 \
  --volume-id vol-0351e8f5c46c88234 --description "auction-day-$(date +%F)"

# 2) зогсоох → төрлийг солих → асаах
aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
aws ec2 wait instance-stopped --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
aws ec2 modify-instance-attribute --region ap-southeast-1 \
  --instance-id i-01ec0aad80bd34eaa --instance-type t4g.large
aws ec2 start-instances --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
```

Дуудлага худалдаа дууссаны дараа мөн адил аргаар `t4g.micro` руу буцаана.

Өгөгдлийн санг мөн түр томсгож болно:

```bash
aws rds modify-db-instance --region ap-southeast-1 --db-instance-identifier auction-pg \
  --db-instance-class db.t4g.small --apply-immediately
```

---

## 4. СИСТЕМ УНТРААХ

### 4.1 Богино завсарлага (7 хоногоос бага)

Жишээ нь: хоёр дуудлага худалдааны хооронд хэдхэн хоног байвал.

```bash
# зөвхөн серверийг зогсооно, өгөгдлийн санг үлдээнэ
aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
```

Хамгийн энгийн бөгөөд эргэж асаахад амархан. Компьютерийн (EC2) төлбөр зогсоно.

### 4.2 Улирлын төгсгөл (сар, түүнээс дээш)

Энд **өгөгдлийн санг зогсоохоор биш, устгаж снапшот үлдээх** ёстой. Учрыг 5-р хэсгээс үзнэ үү.

**Алхам 1 — эхлээд өгөгдлөө нөөцлөнө** (мөнгөний өгөгдөл тул хоёр давхар нөөцөлнө):

```bash
ssh -i ~/.ssh/auction-key.pem ec2-user@47.130.205.214
# сервер дээр:
source ~/auction/.env
docker run --rm postgres:18 pg_dump "$DATABASE_URL" | gzip > ~/backup-season-end-$(date +%Y%m%dT%H%M%SZ).sql.gz
exit

# өөрийн компьютер руу татаж авна
scp -i ~/.ssh/auction-key.pem \
  ec2-user@47.130.205.214:~/backup-season-end-*.sql.gz ~/Documents/auction-backups/
```

**Алхам 2 — серверийг зогсооно:**

```bash
aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
aws ec2 wait instance-stopped --region ap-southeast-1 --instance-ids i-01ec0aad80bd34eaa
```

**Алхам 3 — өгөгдлийн сангийн снапшот авна:**

```bash
aws rds create-db-snapshot --region ap-southeast-1 \
  --db-instance-identifier auction-pg \
  --db-snapshot-identifier auction-pg-season-end-$(date +%Y%m%d)

aws rds wait db-snapshot-completed --region ap-southeast-1 \
  --db-snapshot-identifier auction-pg-season-end-$(date +%Y%m%d)
```

**Алхам 4 — снапшот бэлэн болсныг ХАРСНЫ ДАРАА өгөгдлийн санг устгана:**

```bash
# эхлээд снапшот үнэхээр байгааг шалгана
aws rds describe-db-snapshots --region ap-southeast-1 --snapshot-type manual \
  --query 'DBSnapshots[].{Id:DBSnapshotIdentifier,Status:Status}' --output table

# зөвхөн дээрх нь "available" гэж харагдсан үед:
aws rds delete-db-instance --region ap-southeast-1 \
  --db-instance-identifier auction-pg \
  --final-db-snapshot-identifier auction-pg-final-$(date +%Y%m%d)
```

⚠️ Тогтмол IP-г (`eipalloc-...`) **бүү суллаарай**. Сард ~$3.6 боловч суллавал IP
өөрчлөгдөж, DNS болон Cloudflare-ийн тохиргоог бүгдийг дахин хийх болно.

---

## 5. ⚠️ RDS-ийн 7 хоногийн урхи — хамгийн чухал зүйл

AWS-д өгөгдлийн санг `stop-db-instance` тушаалаар зогсоовол **дээд тал нь 7 хоног**
зогссон байна. Долоо хоногийн дараа AWS **өөрөө автоматаар эргүүлж асаадаг**, танаас
асуухгүй.

Тиймээс:

| Хэр удаан унтраах вэ | Юу хийх вэ |
|---|---|
| 7 хоногоос бага | RDS-ийг зогсоож болно (эсвэл огт хөндөхгүй) |
| 7 хоногоос удаан | **Заавал** снапшот авч, инстансыг устгана (4.2) |

Хэрэв улирлын завсарт RDS-ийг зөвхөн "зогсоочихвол", 7 хоног тутам өөрөө асаж,
сар бүр бүтэн төлбөр гарсаар байх болно.

---

## 6. Зардлын ойролцоо тооцоо

Сингапурын бүсийн ойролцоо үнэ (сард, USD). Яг тоог AWS Cost Explorer-оос хараарай.

| Төлөв | EC2 | RDS | Диск | IP | Нийт ойролцоогоор |
|---|---|---|---|---|---|
| Бүрэн ажиллаж байхад (`t4g.micro`) | ~$6 | ~$13 + $2.5 | ~$3 | ~$3.6 | **~$28** |
| Зөвхөн EC2 зогсоосон | $0 | ~$15.5 | ~$3 | ~$3.6 | **~$22** |
| Улирлын бүрэн унтраалт (4.2) | $0 | ~$1 (зөвхөн снапшот) | ~$3 | ~$3.6 | **~$8** |

Хамгийн том зардал бол **өгөгдлийн сан**. Зөвхөн серверээ унтраагаад RDS-ээ үлдээвэл
мөнгө нь бараг хэмнэгдэхгүй — үүнийг сайн анзаараарай.

---

## 7. Шалгах жагсаалт

**Асаахын өмнө:**
- [ ] RDS `available` төлөвт орсон
- [ ] Хаяг (endpoint) шалгасан, шаардлагатай бол Secrets Manager шинэчилсэн
- [ ] EC2 `running`
- [ ] 4 контейнер бүгд `Up`
- [ ] `curl -I https://anav.mn` → `200`
- [ ] Тест хэрэглэгчээр нэвтэрч үзсэн
- [ ] Дуудлага худалдааны өмнөх өдөр сервер томсгосон

**Унтраахын өмнө:**
- [ ] `pg_dump` нөөцлөлт авсан, өөрийн компьютерт татсан
- [ ] EC2 зогссон
- [ ] RDS снапшот `available` болсныг **нүдээр харсан**
- [ ] Зөвхөн үүний дараа RDS устгасан
- [ ] Тогтмол IP-г суллаагүй

---

## 8. Асуудал шийдвэрлэх

**Сайт нээгдэхгүй байна.**
Контейнеруудыг шалга:
```bash
ssh -i ~/.ssh/auction-key.pem ec2-user@47.130.205.214 \
  'sudo docker compose -f ~/auction/infra/docker-compose.prod.yml ps'
```

**Контейнер асаад унтарч байна (restarting).**
Ихэвчлэн өгөгдлийн санд холбогдож чадахгүй байгаагийн шинж. Логийг хар:
```bash
ssh -i ~/.ssh/auction-key.pem ec2-user@47.130.205.214 \
  'sudo docker compose -f ~/auction/infra/docker-compose.prod.yml logs --tail=50 web'
```
`DATABASE_URL` буруу байвал `DOMAIN=anav.mn bash infra/deploy.sh` ажиллуулна.

**Сервер удаан, эсвэл унтарч байна.**
RAM дүүрсэн байж магадгүй. `t4g.micro` дээр 1 GB RAM + 4 GB swap л байгаа.
Хүнд ачаалалтай үед 3-р хэсгийн дагуу томсго.

**SSH холбогдохгүй байна.**
Аюулгүйн бүлэг (`sg-040bafa3686b1eab3`) зөвхөн тодорхой IP-аас 22 портыг нээсэн байдаг.
Таны интернэтийн IP солигдсон бол дахин нээх хэрэгтэй.

---

## 9. Анхаарах зүйлс

- Дуудлага худалдаа явж байх үед **хэзээ ч** `pnpm db:seed` бүү ажиллуул — лотын
  төлөвийг дахин тохируулж, явж байгаа арилжааг эвдэнэ. `deploy.sh` үүнээс
  хамгаалсан байгаа (`SKIP_SEED=1`).
- Дуудлага худалдааны өмнө заавал ачааллын тест хийнэ (`runbook.md`-г үз):
  1000 зэрэгцээ WebSocket холболт, нэг лот дээр.
- Нөөцлөлтийн хугацаа одоо **1 хоног** байна. Улирал эхлэхэд 7 хоног болгож
  нэмэгдүүлэхийг зөвлөж байна (2.1-д тушаал байгаа).
