# 🍳 Let We Cook

เว็บติดตามงานของทีม **TechFeed** ในธีมห้องครัว ข้อมูลเก็บใน **Google Sheet** ผ่าน **Google Apps Script** ส่วนหน้าเว็บอยู่บน **GitHub Pages**

```
Browser (GitHub Pages) ──POST text/plain──▶ Apps Script Web App (/exec) ──▶ Google Sheet
         ▲  token 2 ชม.                        ตรวจรหัสผ่าน / token ทุกครั้ง
```

## ภาษาในครัว

| บนหน้าเว็บ | ในข้อมูล | ความหมาย |
|---|---|---|
| Menu | Epic | โปรเจกต์ (รหัส 3 ตัว เช่น `IFM`) |
| Course | Story | ฟีเจอร์ในโปรเจกต์ (รหัส 3 ตัว เช่น `PER`) |
| Food Piece / Kitchen Issue | Task / Bug | ชิ้นงาน ได้ ID แบบ `IFM-PER-T0001`, `IFM-PER-B0001` |
| Ready to Prep · Cooking · Served | To Do · In Progress · Done | คอลัมน์บน Kitchen Board |
| Pantry | Backlog | งานที่ยังไม่หยิบขึ้นบอร์ด |
| Heat | Priority | คำนวณจากวันส่งอัตโนมัติ: ≤7 วัน Urgent · ≤14 High · ≤30 Medium · มากกว่านั้น Low |
| Today's menu | Daily Plan | แผนงานวันนี้ของเชฟแต่ละคน (คัดลอกงานมา ไม่ได้ย้ายออกจากบอร์ด) |

## โครงสร้างโปรเจกต์

```
let-we-cook/
├── src/                       หน้าเว็บ React + Vite
│   ├── config.js              ← URL ของ Apps Script (/exec)
│   ├── team.js                ← หน้าตาตัวละครของเชฟแต่ละคน
│   ├── api.js                 เรียก Apps Script / ข้อมูลตัวอย่างตอน dev
│   └── components/
├── apps-script/
│   ├── Code.gs                ← วางใน Apps Script ของชีท
│   └── appsscript.json
├── tests/                     npm test (รวมเทสต์ Code.gs ในระบบจำลอง)
└── .github/workflows/deploy.yml   build + deploy ขึ้น GitHub Pages อัตโนมัติ
```

## ติดตั้งครั้งแรก

### 1. Google Apps Script

1. เปิด Google Sheet **Let We Cook - Task Database** ซึ่งต้องมีแท็บ People, Epics, Stories, Work Items, Task Assignees, Daily Plans, Activity Log
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมทั้งหมด วางเนื้อหาจาก [`apps-script/Code.gs`](apps-script/Code.gs) แล้วกด **Save**
4. (แนะนำ) **Project Settings** → ติ๊ก *Show "appsscript.json" manifest file in editor* แล้ววางเนื้อหาจาก [`apps-script/appsscript.json`](apps-script/appsscript.json)
5. กลับไปที่แท็บ Google Sheet แล้ว **รีเฟรชหน้า** จะมีเมนู **🍳 Let We Cook** เพิ่มขึ้นมา
6. เมนู 🍳 Let We Cook → **1) ตั้งค่าเริ่มต้น** ครั้งแรก Google จะขอสิทธิ์
   - ถ้าเจอหน้า **"Google hasn't verified this app"** ให้ดูว่าอีเมล developer เป็นบัญชีของเราเองไหม ถ้าใช่ แปลว่าเป็นสคริปต์ที่เราเพิ่งวางเอง ปลอดภัย ให้กด **Advanced → Go to … (unsafe) → Allow**
   - สิทธิ์ที่ขอมี 2 อย่าง คือแก้ไข Google Sheets (อ่านและเขียนงาน) และแสดงหน้าต่างในแอป Google (เมนูและกล่องตั้งรหัส)
7. เมนู 🍳 Let We Cook → **2) ตั้ง / เปลี่ยนรหัสผ่านทีม** ต้องมีอย่างน้อย 8 ตัว และ**ห้ามใช้รหัสเดียวกับระบบเก่า** แล้วบอกรหัสทีมกับสมาชิกแบบส่วนตัว เพราะทุกคนต้องใช้ตอนตั้ง PIN ครั้งแรก
8. กลับไปที่หน้า Apps Script: **Deploy → New deployment** → ⚙️ เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด **Deploy** แล้วคัดลอก **Web app URL** (ลงท้ายด้วย `/exec`)

### 2. ใส่ URL ลงในเว็บ

แก้ไฟล์ [`src/config.js`](src/config.js):

```js
const DEPLOYED_API_URL = "https://script.google.com/macros/s/xxxxxxxx/exec";
```

จากนั้น commit แล้ว push ขึ้น `main`

### 3. เปิด GitHub Pages

บน GitHub ไปที่ **Settings → Pages → Build and deployment → Source: GitHub Actions**
ทุกครั้งที่ push ไป `main` ระบบจะรันเทสต์ build แล้ว deploy ให้เอง ลิงก์เว็บคือ **https://tichaiyut.github.io/let-we-cook/**

## แก้ไขและลบงาน

- **แก้ไข:** กดการ์ด → **แก้ไข** เปลี่ยนได้ทุกอย่าง ทั้งชื่อ รายละเอียด ประเภท Course เชฟ Station และวันส่ง
  - ถ้า**ย้าย Course หรือเปลี่ยน Task ↔ Bug** งานจะได้ **ID ใหม่** เช่น `IFM-PER-T0003 → IFM-DEN-B0001` ผู้รับผิดชอบและเมนูวันนี้ที่อ้างถึงงานนี้จะย้ายตามให้เอง ส่วน ID เดิมบันทึกไว้ใน Activity Log
- **ลบ (ทิ้งจาน):** กดการ์ด → **ทิ้งจาน** ใส่เหตุผลได้ถ้าต้องการ งานจะหายจากบอร์ดไปอยู่แท็บ **Bin**
  - แถวยังอยู่ใน Sheet โดยคอลัมน์ `Deleted` = TRUE พร้อม `DeletedAt` / `DeletedBy` (ระบบเพิ่มคอลัมน์ให้เอง)
  - กด **Undo** ที่แถบแจ้งเตือนได้ภายใน 10 วินาที หรือไปกด **กู้คืน** ในแท็บ Bin เมื่อไหร่ก็ได้
- **ID ไม่ถูกใช้ซ้ำ** ถึงงานจะถูกทิ้ง ถูกย้าย หรือเจ้าของลบแถวออกจาก Sheet เอง เพราะระบบเช็คจาก Activity Log ด้วย
- ถ้าจำเป็นต้องลบถาวรจริง ๆ ให้เจ้าของชีทลบแถวเองในแท็บ Work Items และ Task Assignees

## แก้ Code.gs ภายหลัง

วางโค้ดใหม่ใน Apps Script แล้วไปที่ **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
URL `/exec` ยังเป็นอันเดิม จึงไม่ต้องแก้ `config.js`

## การเข้าครัว (PIN รายคน)

- **ครั้งแรก:** เข้าเว็บ → เลือกชื่อตัวเอง (ขึ้นว่า "ตั้ง PIN ครั้งแรก") → ใส่**รหัสทีม** → ตั้ง **PIN 4 หลัก** 2 รอบ → เข้าครัวได้ทันที
- **ครั้งต่อไป:** เว็บจำชื่อล่าสุดไว้ ใส่ PIN 4 หลักแล้วเข้าได้เลย (ตัวเลขครบ 4 ตัวจะส่งให้อัตโนมัติ)
- **เปลี่ยน PIN:** กดชื่อตัวเองมุมขวาบน → เปลี่ยน PIN เครื่องอื่นที่ login ด้วย PIN เดิมจะถูกให้ออก
- **ลืม PIN:** เจ้าของชีทกดเมนู **🍳 → 3) รีเซ็ต PIN ของเชฟ** แล้วพิมพ์ PersonID จากนั้นเจ้าตัวตั้ง PIN ใหม่ด้วยรหัสทีม
- **รหัสทีม = ทางเข้าสำรอง:** กด "เข้าด้วยรหัสทีม" จะเข้าในชื่อ **Team** ทำงานได้ทุกอย่าง แต่ดู Today's menu ได้อย่างเดียว
- ทุกการกระทำใน Activity Log, Reporter และ DeletedBy ใช้ชื่อคนที่ login จริง ระบบอ่านจาก session ที่เซ็นไว้ ปลอมไม่ได้
- **Today's menu:** ดูของใครก็ได้ แต่แก้ได้เฉพาะของตัวเอง
- เจ้าของชีทดูได้ว่าใครตั้ง PIN แล้วบ้างที่เมนู **🍳 → ตรวจสถานะระบบ**

## ความปลอดภัย

- รหัสทีมและ PIN ทุกคนเก็บเป็น hash + salt ใน Script Properties ไม่มีในโค้ดหรือใน Sheet
  - เปลี่ยนรหัสทีม = ทุกคนต้อง login ใหม่
  - เปลี่ยนหรือรีเซ็ต PIN = เฉพาะคนนั้นต้อง login ใหม่
- login แล้วได้ token อายุ **2 ชั่วโมง** ซึ่งระบุว่าเป็นใคร ทุก request ต้องแนบ token มาด้วย
- **PIN ผิด 5 ครั้ง ชื่อนั้นจะถูกล็อก 2 ชั่วโมง** ไม่ว่าจะลองจากเครื่องไหน ระหว่างนั้นเข้าด้วยรหัสทีมได้
- **รหัสทีมผิด 5 ครั้ง** เบราว์เซอร์นั้นจะถูกล็อก 2 ชั่วโมง
- ถ้ามีการใส่ผิดรวมทั้งระบบ **20 ครั้งใน 10 นาที** ระบบจะหยุดรับ login **15 นาที** (Apps Script มองไม่เห็น IP ของผู้ใช้ จึงป้องกันเป็นชั้น ๆ แบบนี้)
- ตั้ง PIN ที่เดาง่ายไม่ได้ เช่น `0000`, `1111`, `1234`, `4321`
- **Google Sheet ต้องตั้งแชร์เป็น Restricted** อย่าเปิดแบบ *Anyone with the link* เพราะ ID ของชีทเคยอยู่ใน git history
- URL `/exec` ไม่ใช่ความลับ ความปลอดภัยอยู่ที่รหัสผ่านทีม
- ข้อความที่ขึ้นต้นด้วย `= + - @` จะถูกบันทึกเป็นข้อความธรรมดา ไม่กลายเป็นสูตรใน Sheet

## พัฒนาในเครื่อง

```bash
npm install
npm run dev      # http://127.0.0.1:5173 ใช้ข้อมูลตัวอย่างในเบราว์เซอร์ ไม่แตะชีทจริง ไม่ต้อง login
npm test         # เทสต์วันที่/priority + เทสต์ Code.gs (login, lockout, สร้างงาน, Today plan)
npm run build    # ได้ไฟล์ใน dist/
```

ถ้าต้องการให้ `npm run dev` ต่อกับชีทจริง ให้สร้างไฟล์ `.env.local` ที่มี `VITE_USE_LIVE_API=true` ⚠️ ทุกอย่างที่ทำจะถูกเขียนลงข้อมูลจริง

## ภาพตัวละคร

ตอนนี้เชฟแต่ละคนใช้ตราตัวละคร (สี + ไอคอนตามบทบาท) ถ้ามีภาพวาดตัวละครภายหลัง ให้วางไฟล์ไว้ใน `public/characters/` แล้วตั้ง `image` ใน [`src/team.js`](src/team.js) เช่น `image: "characters/sorawee.png"`
**อย่าใช้รูปถ่ายหน้าจริง** เพราะ repo นี้เป็น public

## ขึ้นโฮสต์อื่น (สำรอง)

`npm run build` แล้วอัปโหลดทุกไฟล์ใน `dist/` ไปวางบนโฮสต์ static ที่ไหนก็ได้ (เช่น cpfrun) ไม่ต้องใช้ PHP เพราะ path ทั้งหมดเป็นแบบ relative
