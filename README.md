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
7. เมนู 🍳 Let We Cook → **2) ตั้ง / เปลี่ยนรหัสผ่านทีม** ต้องมีอย่างน้อย 8 ตัว และ**ห้ามใช้รหัสเดียวกับระบบเก่า**
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

## แก้ Code.gs ภายหลัง

วางโค้ดใหม่ใน Apps Script แล้วไปที่ **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
URL `/exec` ยังเป็นอันเดิม จึงไม่ต้องแก้ `config.js`

## ความปลอดภัย

- เก็บรหัสผ่านทีมเป็น hash + salt ใน Script Properties ไม่มีในโค้ดหรือใน Sheet ถ้าเปลี่ยนรหัส ทุกคนต้อง login ใหม่
- login แล้วได้ token อายุ **2 ชั่วโมง** ทุก request ต้องแนบ token มาด้วย
- ใส่รหัสผิด **5 ครั้ง** เบราว์เซอร์นั้นจะถูกล็อก **2 ชั่วโมง** และถ้ามีการใส่ผิดรวมทั้งระบบ **20 ครั้งใน 10 นาที** ระบบจะหยุดรับ login **15 นาที** (Apps Script มองไม่เห็น IP ของผู้ใช้ จึงป้องกันเป็น 2 ชั้นแบบนี้)
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
