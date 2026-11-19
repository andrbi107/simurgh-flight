# سیمرغ: پرواز به قاف (Simurgh: Flight to Qaf)

> بازی پرواز/جاخالی‌دادن عمودی با تم اسطوره‌ای فارسی — سیمرغ از هفت وادی منطق‌الطیر به قاف پرواز می‌کند.

[![Version](https://img.shields.io/badge/version-v0.0.1-blue)](https://github.com/andrbi107/simurgh-flight/releases/tag/v0.0.1) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/simurgh-flight/) [![No deps](https://img.shields.io/badge/dependencies-none-success)](https://github.com/andrbi107/simurgh-flight) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/simurgh-flight/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/simurgh-flight)** · 🏷️ **[Release v0.0.1](https://github.com/andrbi107/simurgh-flight/releases/tag/v0.0.1)**

---

## معرفی

«سیمرغ: پرواز به قاف» یک بازی پرواز و جاخالی‌دادن عمودی ۲بعدی است که با Vanilla JS روی یک HTML5 `<canvas>` با رابط کاربری راست‌به‌چپ فارسی ساخته شده. این بازی اسطوره‌ی «منطق‌الطیر» عطار را به‌صورت یک arcade flight بازتصور می‌کند: شما سیمرغ، پرنده‌ی اسطوره‌ای فارسی، هستید و از هفت وادی (طلب، عشق، معرفت، استغنا، توحید، حیرت، فقر و فنا) به سمت کوه قاف پرواز می‌کنید.

هویت بصری مینیاتور فارسی است: پس‌زمینه‌ی parchment گرم با قاب طلایی و گوشواره‌های کناری، نوارهای parallax شن‌ها و ذرات طلایی متحرک، و کوه قاف به‌صورت یک مثلث lapis با برف و هاله‌ی طلایی در بالای صفحه. تمام سیمرغ با primitives رسم می‌شود — بدنه‌ی بیضی طلایی، بال‌های turquoise با انیمیشن flap، و دم peacock با هفت چشم.

## ویژگی‌ها

- **هفت وادی** با اسم و رنگ accent اختصاصی هر یک، با نوار پیشرفت در لبه‌ی راست.
- **سیمرغ کاملاً از primitives** — بدنه‌ی طلایی، بال‌های turquoise، دم peacock با هفت eye-spot، انیمیشن flap.
- **موانع متنوع** — ابرهای طوفان، تیر کمان‌دارها، gemهای تعلق دنیوی (امتیاز می‌دهند ولی پیشرفت وادی کم می‌کنند).
- **pickupها** — feather (جان/امتیاز)، پرنده‌ی همراه (امتیاز + همراه timed)، هر ۵ feather یک همراه دائمی.
- **کوه قاف** در بالای صفحه با هاله‌ی طلایی؛ رسیدن به آن = صفحه‌ی پیروزی.
- **حالت بی‌پایان** پس از پیروزی: وادی‌ها بی‌نهایت ادامه می‌یابند و دشواری رشد می‌کند.
- **۳ جان + invulnerability** چشمک‌زن، screen shake، و `navigator.vibrate` اختیاری.
- **کنترل کامل تاچ + کیبورد + موس** — هر سه به یک حرکت eased یکسان خوراک می‌شوند.
- **PWA آفلاین** با رابط RTL فارسی.

## نحوه‌ی بازی

| دستگاه | حرکت | توقف |
|---|---|---|
| **تاچ** | drag روی کانواس به سمت اشاره‌گر (افقی + عمودی درون band) | دکمه‌ی Pause |
| **کیبورد** | ←/→ یا A/D افقی · ↑/↓ یا W/S عمودی | P یا Esc |
| **موس** | حرکت موس روی کانواس (بدون کلیک) سیمرغ را هدایت می‌دهد | دکمه‌ی Pause |

### مکانیک بازی

- **band بازیکن**: سیمرغ به یک band عمودی `[0.44H, 0.86H]` محدود است.
- **auto-scroll**: `scrollSpeed = baseScroll * (1+scrollPerValley)^valleyIndex`.
- **اسپاون**: با weighted random؛ interval = `baseSpawn * spawnPerValley^valleyIndex` با floor.
- **برخورد**: دایره-دایره با `r+r`؛ ابرها عبور می‌کنند، تیرها مصرف می‌شوند، pickupها همیشه مصرف می‌شوند.
- **جان**: شروع ۳، حداکثر ۵؛ هر hit → −۱ جان + invuln چشمک‌زن؛ ۰ جان = انیمیشن سقوط سپس گیم‌اور.
- **feather**: اگر `lives<max` → +۱ جان، در غیر این صورت امتیاز؛ هر ۵ feather یک همراه دائمی (حداکثر cap).
- **gem**: +امتیاز ولی `distValley -= valleyLen * gemPenalty` + drift جانبی موقت.
- **همراهان**: در تشکیل V دنبال سیمرغ می‌آیند، هر کدام +۱/s امتیاز پیوسته.
- **وادی‌ها**: طلب، عشق، معرفت، استغنا، توحید، حیرت، فقر و فنا؛ تکمیل وادی ۶ = پیروزی.
- **امتیاز**: distance + companion/s + pickupها؛ رکورد در `localStorage['simurgh.best']`.

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | `lang="fa" dir="rtl"`، canvas، HUD و overlayها |
| `styles.css` | تم parchment/gold/lapis، clamp، safe-area، `100dvh` |
| `main.js` | کل بازی: config، state، input، spawn، update، render، HUD، صدا، loop |
| `manifest.json` | PWA، `display:fullscreen`، `orientation:portrait` |
| `sw.js` | precache shell و سرو آفلاین |
| `icon.svg` | سیلوئت سیمرغ با دم peacock روی مربع parchment |

## شخصی‌سازی

تمام پارامترها در شیء `CFG` بالای `main.js`:

- `baseScroll`, `scrollPerValley` — سرعت world و رشد per-valley.
- `baseSpawn`, `spawnPerValley`, `minSpawn`, `spawnJitter` — کاتدنس و تراکم اسپاون.
- `valleyLen`, `valleyLenPerValley` — مسافت پاک‌سازی هر وادی.
- `bandTop`, `bandBottom` — band عمودی مجاز برای سیمرغ.
- `maxLives`, `startLives`, `invulnMs`, `driftMs`, `blinkMs` — جان و تایمینگ hit/distraction.
- `gemPenalty`, `gemScore`, `featherScoreMax`, `companionScore`, `companionTtl`, `feathersPerCompanion`, `maxCompanions` — اثر pickupها.
- `scoreRate` — ضریب distance→score.
- آرایه `VALLEYS` — نام و رنگ accent هر وادی؛ `ENDLESS_NAME` لیبل حالت بی‌پایان.
- شیء `COL` — پالت رنگ.

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/simurgh-flight.git
cd simurgh-flight
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/simurgh-flight/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.
