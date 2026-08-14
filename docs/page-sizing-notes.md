# ملاحظات ضبط حجم الصفحات (375×812)

## النتائج من اللقطات الكاملة (full page، عرض الهاتف 375):
- `/` (index): صفحة كبيرة جدًا - الشعار يبتعد عن المحتوى بسبب flex-1؛ المحتوى يظهر في أسفل الشاشة (يحتاج ضغط).
- `/home`: تبدو مضغوطة ومناسبة تقريبًا، لكن السلايدر والمقدمة لها مسافات كبيرة يمكن تقليصها قليلًا.
- `/register`: نفس مشكلة index - الشعار أعلى والمحتوى في الأسفل بسبب flex-1.
- `/pharmacy-quote`: مناسبة عمليًا لكن يمكن تقليص المسافات بين الأقسام.
- `/lab-quote`: مشابهة للصيدلية، تقليص بسيط.
- `/quote-offers`: بطاقات العروض طويلة (6 عروض)، تحتاج بطاقات أكثر إحكامًا في الارتفاع.
- `/care-request`: تحتوي فراغًا كبيرًا تحت الزر؛ تقليص المسافات.
- `/profile`: تظهر شاشة تحميل - طبيعية في المعاينة (تحميل العناوين).

## خطة الضغط:
1. الشاشات الرئيسية (index, register): جعل المحتوى يبدأ من أعلى بمسافة معقولة بدل التمدد flex-1 مع فراغ كبير.
2. home: تقليص ارتفاع السلايدر ومسافات المقدمة قليلاً.
3. pharmacy-quote/lab-quote: تقليص مسافات العناوين والبطاقات.
4. quote-offers: تقليص ارتفاع بطاقة العرض.
5. care-request: تقليص المسافات العامة.

## الأيقونة (مكتملة):
- تم توليد أيقونة مربعة 1024×1024 من الشعار الكامل (tabibi-brand.png) → /home/ubuntu/tabibi-brand-square.png
- طُبقت على: icon.png, splash-icon.png, favicon.png, android-icon-foreground.png

## الحالة بعد آخر لقطات (375×812):
- / و /register: الشعار كبير مع فراغ عمودي كبير (flex-1) — يحتاج ضغطًا.
- /home: مضغوطة تقريبًا، يمكن تقليص مسافات السلايدر قليلًا.
- /profile: شاشة تحميل في المعاينة (طبيعية)، لكن المستخدم يراها كبيرة — تصغير الشعار والمسافات.
- pharmacy-quote/lab-quote: تقليص بسيط للمسافات.
- quote-offers: بطاقات العروض طويلة — تقليص ارتفاع البطاقة.
- care-request: فراغ كبير تحت الزر — تقليص المسافات.

## حالة التقدم (3:25 PM):
- ✅ الأيقونة: مولدة ومطبقة على icon/splash/favicon/android-foreground من tabibi-brand.png (1024×1024 بيجية)
- ✅ register.tsx: صُغّر الشعار إلى 104، تقليل padding وgap وmargin (تم)
- ℹ️ index.tsx: شاشة تحميل فقط (ActivityIndicator)، لا تحتاج ضغطًا
- ⬜ profile.tsx: الشعار في header (~styles.logo margin 20) — تقليص الشعار والمسافات
- ⬜ pharmacy-quote.tsx: تقليص مسافات (content padding 20→14، notice gap، حقول)
- ⬜ lab-quote.tsx: مطابق للصيدلية — نفس التقليص
- ⬜ quote-offers.tsx: تقليص بطاقات العروض (padding البطاقة، gap بين بنود العرض)
- ⬜ care-request.tsx: تقليص فراغ تحت الزر (content padding، card margin، button margin)
- ⬜ home.tsx: تقليص بسيط للسلايدر (126→110) ومسافات الأقسام
- بعدها: التحقق باللقطات، ثم checkpoint وتسليم

## تقدم الجلسة الحالية (ضبط الصفحات + الأيقونة الجديدة)

### مكتمل:
- [x] توليد أيقونة مربعة 1024 من الشعار الكامل (/home/ubuntu/tabibi-brand-square.png) ونسخها إلى icon.png وsplash-icon.png وfavicon.png وandroid-icon-foreground.png
- [x] ضغط register.tsx: الشعار 90px، مسافات p-6→p-4، gap-5→gap-3، بطاقة borderRadius 24→16
- [x] ضغط index.tsx: الشعار 80px، تقليل مسافات السلايدر والمكونات
- [x] ضغط profile.tsx: الشعار 64px، تقليل مسافات البطاقات
- [x] sed: pharmacy-quote.tsx وlab-quote.tsx (padding 20→12، fontSize 22→18، card marginTop 14→8، inputs minHeight 76→64، كل marginTop 7→4، borderRadius 20→14/13→10)

### متبقٍ:
- [ ] فحص quote-offers.tsx وضغطه بنفس المنطق
- [ ] فحص home.tsx، doctor-specialties، doctor-search، nursing-search، mental-health، assisted، home-service، quote-offers بصريًا بـ webdev_take_screenshot viewport [375,812]
- [ ] تشغيل pnpm check وpnpm test
- [ ] حفظ checkpoint
- [ ] ملاحظة: dev server log أظهر أخطاء Metro سابقة كانت وقتية (مراقبة tsc استهلكت الذاكرة، أُوقفت)

## نتائج المراجعة البصرية الثانية (375x812)
- `/` (index): الشعار لا يزال في أسفل الشاشة مع فراغ كبير أعلى — يلزم رفعه إلى وسط الشاشة.
- `/register`: نفس الوضع، الشعار في أسفل الشاشة — يلزم رفعه.
- `/profile`: spinner تحميل في اللقطة — لا يُحكم عليه منها، لكن الشعار صُغّر والمسافات ضُغطت.
- `/pharmacy-quote` و `/lab-quote`: مضغوطة جيدًا، كل الحقول في شاشة واحدة.
- `/quote-offers`: مضغوطة جيدًا، البطاقات ظاهرة بوضوح.
- `/home`: مضغوطة، السلايدر والشبكة والبانر في شاشة واحدة.
- المتبقي: ضغط index وregister (رفع الشعار إلى المنتصف بدل الأسفل).

## حالة register.tsx الحالية (4:27 PM)
- الشعار 104px، header marginBottom 8، content paddingTop 4 — التنسيق مضغوط نسبيًا.
- المشكلة الظاهرة في اللقطة: الشعار يظهر في أسفل الشاشة لأن ScrollView لا يملأ الارتفاع (flex) — يجب إضافة flexGrow: 1 إلى contentContainerStyle ليبدأ المحتوى من الأعلى بدل الأسفل؟ لا — المشكلة عكسية: المحتوى مضغوط لكنه يظهر في الأسفل بسبب justifyContent افتراضي.
- الحل: إزالة marginTop الكبير أو إضافة justifyContent: flex-start — contentContainerStyle حاليًا بدون justifyContent؛ المشكلة الحقيقية أن KeyboardAvoidingView flex:1 والمحتوى قصير فيظهر في الأسفل فقط إن كان هناك عنصر دفع. يجب التحقق من screen-container.
- الإجراء: إضافة justifyContent: "flex-start" إلى contentContainerStyle؟ لا — المشكلة في اللقطة السابقة كانت الشعار في أسفل الشاشة. الأفضل: تقليل شادو formCard (shadowRadius 18) وتصغير الشعار إلى 96 وضغط إضافي بسيط.

## نتائج المراجعة البصرية (4:30 PM)
- /home مضغوطة ومقبولة، تبقى مساحة فارغة صغيرة أسفل البنر (مقبولة بسبب ScrollView).
- /doctor-specialties جيدة وتحتوي 12 بطاقة، أطول من الشاشة قليلًا (مقبول).
- /pharmacy-quote مضغوطة ومناسبة للشاشة.
- /quote-offers مضغوطة وتحتوي 6 عروض مع فلترة.
- /register المشكلة الرئيسية المتبقية: الشعار يظهر في منتصف/أسفل الشاشة بسبب flex داخل KeyboardAvoidingView، يجب تثبيت المحتوى أعلى الشاشة.
- /profile يظهر مؤشر تحميل فقط في المعاينة (سلوك معاينة طبيعي لعدم وجود بيانات).

## المتبقي
- إصلاح محاذاة register: المحتوى يبدأ من أعلى (الشعار في أسفل الشاشة الآن).
- index عبارة عن spinner في المنتصف (طبيعي).

## تشخيص مشكلة register (4:45 PM)
المشكلة: شاشة التسجيل تظهر بها فراغات كبيرة والمحتوى يبدأ من الأسفل عند المعاينة (محاكاة 375×812 بدون كيبورد).
السبب المحتمل: KeyboardAvoidingView style={styles.flex} flex:1 + ScrollView contentContainerStyle لا يحتوي flexGrow → المحتوى يبقى بأطول ارتفاع طبيعي له. لكن ظهوره في "الأسفل" يعود غالبًا لأن screen-container يجعل المحتوى يتمدد، وKeyboardAvoidingView في web يدفع المحتوى للأسفل عند عدم وجود كيبورد.
الحل المعتمد: محتوى يبدأ من الأعلى بمسافات مضغوطة موجودة فعلًا (header marginTop: 8, content paddingTop: 4). في محاكاة الويب قد يظهر فراغ بسبب behavior. الحل: عدم استخدام KeyboardAvoidingView على web، أو جعل contentContainerStyle يبدأ flex-start بشكل صريح.
ملاحظة: form-field.shared: input minHeight 56 — مقبول، 4 حقول × 80px ≈ 320px + header + button ≈ 480px؛ يجب أن يتسع في شاشة واحدة.

## تشخيص نهائي (4:33 PM)
اللقطات (viewport 375x812): المحتوى كله يتكدس في أسفل الشاشة — حتى اللقطة الأولى full_page تظهر الشعار في أسفل الصفحة مع فراغ هائل فوقه.
ScreenContainer سليم (flex-1 ثلاثي طبيعي). المشكلة في `KeyboardAvoidingView behavior={undefined}` على web: في محاكاة المتصفح، KAV مع behavior undefined يعامل المحتوى بشكل مختلف (y-offset خاطئ يجعل المحتوى يُعرض في أسفل View).
الحل: `behavior={Platform.OS === "ios" ? "padding" : "height"}` — height يدفع المحتوى للأعلى في web وandroid، وهو السلوك المطلوب للشاشات الطويلة.

## متابعة (4:34 PM)
تغيير behavior إلى "height" لغير iOS لم يحل المشكلة — اللقطة ما زالت تظهر الشعار صغيرًا في أسفل الشاشة. المشكلة أعمق: يبدو أن ScrollView لا يعرض سوى آخر جزء من المحتوى... لا، الشعار نفسه يظهر وحده في الأسفل — يبدو أن محتوى ScrollView يُقَصّ ولا يُعرض سوى جزء صغير منه، أو أن المحتوى يُعرض في أسفل الارتفاع المتاح.
الحل الجذري: إزالة KeyboardAvoidingView من register (يمكن إعادة تفعيله لاحقًا إذا لزم على الجوال) واختبار المحتوى مباشرًا داخل ScreenContainer.

## تشخيص نهائي مثبت (4:36 PM)
/home تعمل بشكل سليم (شعار أعلى + محتوى + بيب + زر)، أي بنية ScreenContainer + ScrollView سليمة.
/register: يظهر فقط الشعار في الأسفل — KAV يحجب كامل بقية المحتوى ويعرض شاشة في الأسفل. السبب الجذري: KeyboardAvoidingView في web عند عدم وجود كيبورد يقيس ارتفاعًا خاطئًا (يقيس نافذة الويب كاملة لكن يتعامل مع SafeAreaView flex-1 بشكل خاطئ) ويقلص محتوى inner View إلى ارتفاع صفر تقريبًا، فلا يظهر سوى محتوى يتدفع لأسفل View الأصلي.
الحل الجذري المطبق: استبدال KAV بـ View بسيط في register (المحتوى لن يحتاج تفادي لوحة مفاتيح لأن الحقول في الأعلى)، أو استخدام KeyboardAvoidingView فقط على iOS/Android. القرار: إزالة KAV من register نهائيًا (تجربة نظيفة: محتوى من الأعلى، وScrollView يستجيب تلقائيًا للكيبورد على الجوال).

## بعد التشخيص المستقل (4:40 PM)
FormField سليم: لا position absolute ولا height=0. كل شيء يبدو طبيعيًا في الكود. اللقطة تظهر الشعار وحده في أسفل الشاشة مع فراغ هائل فوقه، واللقطة full_page تظهر أن ارتفاع الصفحة الكلي صغير نسبيًا — أي أن محتوى ScrollView معروض بالكامل لكنه مكدّس في أسفل الشاشة.
فرضية جديدة: المشكلة ليست في register بل في _layout أو root: في react-native-web، SafeAreaView مع edges=["bottom"] يعطي padding سفلي، وScreenContainer داخلي flex-1. لكن /home يعمل... الفرق الوحيد: register يستخدم ScreenContainer edges=["top","bottom","left","right"] بينما /home يستخدم default edges. edges bottom على ScreenContainer داخل tab layout قد يضيف padding-bottom كبيرًا ثم يتعارض مع شيء آخر.
الاختبار التالي: تبديل edges إلى ["top","left","right"] في register.

## تحليل المقارنة (4:45 PM)
home.tsx: ScreenContainer edges default (top/left/right) — يعمل. register: نفس البنية تقريبًا. الفرق الظاهر في اللقطات: register تظهر خلفية الشاشة فقط مع الشعار في أسفل نصف الشاشة، home تظهر كاملة.
ملاحظة دقيقة: في لقطة register يظهر الشعار في منتصف-أسفل الشاشة مع فراغ علوي ضخم (~500px) — هذا يشبه أن المحتوى الكلي صغير (شعار 86px + نصوص) وأن SafeAreaView يضيف padding علوي ضخمًا جدًا! في register edges=[top] + providerInitialMetrics يفرض top: max(...,16). لكن في home نفس thing.
إعادة النظر في اللقطة: الفراغ العلوي ~500px من أصل 812، والشعار في ~570px. لو SafeArea top padding كبير جدًا على الويب (subscribeSafeAreaInsets يرسل insets من iframe قد تكون خاطئة)، كل محتوى ScreenContainer سيدفع للأسفل... لكن home يظهر الشعار في الأعلى!
الفرق الوحيد الفعلي بين الشاشتين في طريقة العرض: /home ضمن (tabs) layout (tab bar)، بينما /register Stack شاشة كاملة. Stack screen قد يعطيه ارتفاع iframe كامل (812)؛ edges top = insets.top (كبير من iframe). في home، tab bar يعالج الارتفاع.
الاحتمال: insets.top من iframe preview كبير (~500) لعمق معين. الحل: استخدام initialWindowMetrics الافتراضية فقط على الويب بدل iframe insets — لكن home تعمل... 
اختبار حاسم: مقارنة screenshot بعمق iframe الحالي. أو الأفضل: تشغيل pnpm check + الاختبارات ثم تسليم للمستخدم للتجربة على الجهاز الفعلي؛ مشكلة register قد تكون Artifact في أداة اللقطة فقط (full_page=true يعرض الشعار في الأسفل = علامة overflow cropping). 
الخطوة التالية: اختبار بمتصفح حقيقي عبر exposure أو التحقق console. 

## اكتشاف حاسم عبر console DOM (4:48 PM)
المحتوى موجود كاملًا! لكن viewport = 1280x1100 (المعاينة تعرض بارتفاع 1100px وليس 812). المشكلة: صورة الشعار TabibiBrand بـ width={86} وaspectRatio 0.78 → height=110px لكن في DOM أظهرت h:1155, w:86! — صورة aspect-ratio غير محسوبة بشكل صحيح في web: الـ IMG مع style width=86 + aspectRatio لم يُطبّق aspectRatio في CSS، فالصورة تمددت للارتفاع الطبيعي 1155px.
هذا يفسر لماذا يمتد المحتوى لـ1750px+ ولماذا اللقطة أظهرت الشعار في الأسفل (scroll تلقائي أو snapshot من الأسفل).
الحل: استبدال aspectRatio بـ height ثابت محسوب في TabibiBrand: height = width * 1.28 (1/0.78 ≈ 1.28) — أي width: 86 → height: 110.
ملاحظة: في الجوال aspectRatio يعمل صحيحًا (هذا سبب أن اللقطات على الجوال ربما تكون سليمة). لكن حتى الجوال قد يتأثر إذا كان aspectRatio لا يعمل مع Image في بعض الإصدارات — safest: height ثابت.

## نجاح الإصلاح (4:49 PM) — إغلاق المشكلة نهائيًا
الحل: تثبيت height لصورة TabibiBrand (width/0.78) بدل aspectRatio الذي يفشل في react-native-web.
اللقطة النهائية لـ /register تظهر الشاشة كاملة ومضغوطة: الشعار أعلى، العنوان والوصف، بطاقة النموذج بحقولها الأربعة، زر إنشاء الحساب، ونص الخصوصية — كلها في شاشة واحدة 375×812.
التشخيص المستقبلي: أي شاشة تظهر "فراغ كبير في الأعلى/الأسفل" على الويب = suspect aspectRatio على Image.
المتبقي: فحص سريع لشاشات أخرى تستخدم TabibiBrand (profile، care-request) ثم pnpm check + pnpm test ثم checkpoint.

## المراجعة البصرية النهائية قبل checkpoint (4:50 PM)
- /register: ممتازة — الشعار أعلى، النموذج كامل، زر الخصوصية، شاشة واحدة.
- /home: ممتازة — شعار + أهلاً + سلايدر + شبكة 7 خدمات + بنر.
- /quote-offers: جيدة — فلاتر + 6 بطاقات عروض مضغوطة.
- /pharmacy-quote: ممتازة — كل الحقول في شاشة واحدة.
- /care-request: ممتازة — نوع الخدمة + حقلين + زر في شاشة واحدة.
- pnpm check: 0 أخطاء. pnpm test: 27 passed / 1 skipped.
- المتبقي: مراجعة todo.md ثم webdev_save_checkpoint ثم تسليم للمستخدم.

## ميزة التصفية والفرز في صفحة العروض (طلب المستخدم الجديد)
المطلوب: خيارات تصفية وفرز في quote-offers.
المنجز حتى الآن:
1. lib/quote-offers.ts: أُضيفت أنواع QuoteOfferSort (price-asc/price-desc/distance/rating) وQuoteOfferQuery (filter/sort/maxPrice/maxDistanceKm)، وتحديث getQuoteOffers لاستقبال query كامل مع فلترة maxPrice وmaxDistanceKm وفرز حسب المطلوب. أُضيف getQuoteOfferRating (تقييم حتمي 4.0-5.0 مبني على hash من id) وQUOTE_OFFER_SORT_LABELS.
2. tests/quote-offers.test.ts: كُتبت اختبارات جديدة لنموذج query (فرز تصاعدي/تنازلي/مسافة/تقييم + فلترة سعر/مسافة + دمج فلاتر + التسميات).
المتبقي:
- تحديث app/quote-offers.tsx: استبدال getQuoteOffers(filter) وgetQuoteOffers("all") بنموذج query، إضافة حالة sort وmaxPrice وmaxDistanceKm، واجهة مستخدم: شريط فرز أفقي (أيقونة + قائمة خيارات) + مرشحان للسعر (حتى 100/150/200/الكل) والمسافة (حتى 2/4/6 كم/الكل). عرض التقييم داخل بطاقة العرض.
- ملاحظة: بطاقة العرض تعرض حاليًا distanceKm وvalidUntil في سطر واحد؛ عند إضافة التقييم يجب عدم المبالغة في الطول (ضغط الشاشة).
- ثم: pnpm check + pnpm test + لقطات /quote-offers + checkpoint + تسليم.

## تحقق بصري لصفحة العروض (بعد التصفية والفرز)
الشاشة تعرض الآن ضمن صندوق مضغوط: أزرار المصدر (الكل/الصيدليات/المختبرات)، قسم "فرز حسب" بأربع شرائح (الأقل سعرًا/الأعلى سعرًا/الأقرب/الأعلى تقييمًا)، وصفَّين للسعر حتى والمسافة حتى. بطاقات العروض تعرض التقييم بشارة ذهبية ضمن سطر المسافة. لا تجاوز في العرض، والتمرير طبيعي. الاختبارات: 34 نجاحًا، TypeScript نظيف.
