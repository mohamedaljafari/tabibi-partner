# ملاحظات التقدم — 14 أغسطس (قبل بدء تطبيق الشريك المنفصل)

## حالة المشروع الحالي (tabibi-mobile = تطبيق المريض + لوحة تحكم admin)
- checkpoint الأخير: 2c627171
- الشاشات: app/login.tsx (أول صفحة — دخول بالاسم+كلمة مرور، رابط إنشاء حساب)، app/register.tsx، app/home.tsx (صفحة شخصية وإتمام البيانات)، app/(tabs)/index.tsx، requests.tsx، wallet.tsx، app/admin.tsx (PIN 10081460020501)، quote-offers.tsx
- lib/patient-profile.ts يحفظ passwordHash الآن + updatePatientPassword
- قيد دفع تلقائي عند confirmOffer في quote-offers؛ قيد completed في requests.tsx للشريك (إشعار request_completed)
- صفحة العروض والدفع النقدي/إلكتروني موجودة (quote-offers)
- الطلبات بين المريض والشريك عبر storage مشترك: service_requests_v1، incoming_requests_v1 (في lib/_e2e/provider-auth? أو service-requests)، provider_accounts_v1، ratings_v1، wallets_v1، notifications_v1، chat_v1
- 152 اختبارًا ناجحًا

## المطلوب الآن (طلب المستخدم)
1. تطبيق منفصل لمقدم الخدمة (طبيب شريك) — مشروع جديد منفصل
2. تسجيل دخول الشريك (رقم هاتف + كلمة مرور) كأول صفحة + زر إنشاء حساب
3. إتمام بيانات الشريك: تخصصات متعددة، مستندات، خبرة، خدمات بالأسعار والمدد، مواعيد (متاح الآن + توقيتات)
4. الطلبات الواردة: قبول/رفض مع إشعار للمريض
5. الدردشة والأرباح في تطبيق الشريك
6. آلية الدفع عند حجز المريض لمقدم الخدمة:
   - صفحة دفع بعد «احجز الآن»: نقدي (دائمًا) + إلكتروني (يظهر فقط بعد قبول الشريك)
   - نقدي: تأكيد فوري للشريك (يُستلم بعد انتهاء الخدمة)
   - إلكتروني: ينتظر الشريك تأكيد اكتمال الدفع قبل التحرك

## ملاحظات معمارية لمشروع الشريك
- يجب استخدام نفس مفاتيح storage المشتركة حتى يعمل التطبيقان معًا (provider_accounts_v1، service_requests_v1، incoming_requests_v1، chat_v1، wallets_v1، notifications_v1، ratings_v1)
- المنطق المشترك موجود في tabibi-mobile/lib/: service-requests.ts، provider-registry.ts، provider-auth.ts (hashPassword/verifyProviderLogin)، chat، wallets، ratings، notifications
- في المشروع الجديد: نسخ هذه المكتبات كما هي أو استيرادها (نسخة مستقلة في lib/shared)
- بوابة الشريك: app/index.tsx → login ثم home أو setup
