// Message templates in Jordanian Arabic with everyday English tech terms. {placeholders} are filled
// by the planner. Each stage has several phrasings so conversations don't repeat word for word.

export const T = {
  // ---- Scenario A: a business hires the developer ----
  request: [
    "مرحبا {owner}، يعطيك العافية 🙏 حابين نعمل {service} لـ{biz}، بتشتغل هيك مشاريع؟",
    "هلا، أخذنا رقمك من واحد صاحبنا. بدنا {service} للمحل، ممكن نحكي؟",
    "السلام عليكم، معك {contact} من {biz}. بدنا حدا يعملنا {service} بأسرع وقت 😅",
    "مرحبا، شفت شغلك عالإنستا وعجبني كتير 🔥 بدنا {service}، قديش بتاخد تقريباً؟",
    "مساء الخير، عنا فكرة {service} ومحتارين مين يعملها. فاضي تحكي معنا شوي؟",
  ],
  repeatRequest: [
    "هلا {owner} 👋 بدنا نرجع نشتغل معك، المرة هاي بدنا {service}",
    "مرحبا مرة تانية 😄 الشغل الأول كان ممتاز، وهسا بدنا {service}",
    "يعطيك العافية، عنا مشروع جديد: {service}. شو رأيك؟",
  ],
  interested: [
    "هلا والله، أكيد بشتغل هيك مشاريع 👍 احكيلي شو بالزبط بدكم؟",
    "يا هلا، تشرفنا. ممكن تحكيلي أكتر عن الفكرة؟ مين الـ target users وشو أهم الـ features؟",
    "أهلين، أكيد. خبرني شو الـ requirements الأساسية عشان أعطيك estimate دقيق",
    "هلا فيكم، على راسي. ابعتولي التفاصيل وبحكيلكم السعر والمدة",
  ],
  requirements: [
    "بدنا يكون فيه {f1} و{f2}، وكمان {f3} إذا بتقدر",
    "أهم إشي {f1}، وبدنا {f2}. والـ design يكون بسيط وألوانه زي اللوغو تبعنا",
    "شوف، الزباين بدهم {f1}. واحنا من جوا بدنا {f2} نشوف فيه كل إشي",
    "بدنا {f1} و{f2}. وإذا في مجال {f3} بكون أحلى",
  ],
  clarify: [
    "تمام، سؤال: بدكم إياه عربي وانجليزي ولا عربي بس؟",
    "واضح. في عندكم domain و hosting ولا بدكم أدبرلكم ياهم؟",
    "منيح. الـ content والصور من عندكم ولا بدكم أساعد فيهم؟",
    "تمام. في deadline معين لازم نلحقه؟",
  ],
  clarifyAnswer: [
    "عربي وانجليزي إذا ما في إزعاج",
    "ما عنا إشي، دبرلنا انت",
    "الصور من عنا، والنصوص بنبعتلك ياها خلال يومين",
    "يا ريت قبل آخر الشهر، بس مش ضروري كتير",
    "زي ما بتشوف انت، انت أخبر",
  ],
  quoteIntro: [
    "تمام، حضرتلكم عرض سعر 👇",
    "هاي التكلفة التقريبية حسب اللي حكيناه:",
    "بعد ما شفت كل الـ requirements، هاد العرض:",
  ],
  quoteOutro: [
    "المجموع: {total} دينار، ومدة التنفيذ تقريباً {days} يوم",
    "الإجمالي {total} دينار. بخلص خلال {days} يوم إن شاء الله",
  ],
  negotiate: [
    "والله السعر شوي عالي علينا 😅 في مجال تنزل شوي؟",
    "ممتاز بس الميزانية محدودة، بتقدر تعملها بـ{counter}؟",
    "طيب في خصم إذا دفعنا عربون من هسا؟",
    "شوي غالي يا {owner}، بنعطيك {counter} وخلص 🙏",
  ],
  counter: [
    "عشانكم بنزلها لـ{final} دينار، وهاد آخر إشي صدقني 🙏",
    "بقدر أعمل خصم {discount} دينار، بصير المجموع {final}",
    "ماشي، خليها {final} وما نختلف 😄",
  ],
  noNegotiationAgree: ["السعر منيح، توكل على الله 👍", "تمام موافقين، متى بتبلش؟", "deal 🤝"],
  agree: [
    "تمام اتفقنا 👍 متى بتبلش؟",
    "ماشي، على بركة الله. شو المطلوب منا؟",
    "deal 🤝 ابعتلنا شو بدك منا",
    "اوكي موافقين",
  ],
  kickoff: [
    "ببلش من بكرا إن شاء الله. بدي منكم اللوغو والألوان والصور، وبعتلكم أول نسخة خلال أسبوع",
    "تمام، بعتلكم أول design خلال كم يوم. إذا عندكم أي reference عاجبكم ابعتوه",
    "على بركة الله. رح أعمل group صغير للـ updates، وبحكيلكم أول بأول",
  ],
  depositTerms: [
    "بنبلش بعربون 50% ({deposit} دينار) والباقي عند التسليم، تمام؟",
    "العادة عندي عربون نص المبلغ ({deposit} دينار)، والباقي لما نسلم",
  ],
  depositPaid: ["حولتلك العربون {deposit} عالكليك ✅", "تم تحويل العربون {deposit}، شوفه وطمني"],
  depositThanks: ["وصل العربون، شكراً 🙏 بلشت", "تمام وصل ✅ ببلش اليوم"],
  // Generic lines for build projects; each service in SERVICES adds its own.
  progress: [
    "أول نسخة من الـ design جاهزة، شوفوها وخبروني رأيكم",
    "رفعت نسخة تجريبية على staging، جربوها وخبروني: https://staging.example.com/{slug}",
    "صار في bug صغير وصلحته ✅",
    "update سريع: خلصنا تقريباً 70% من الشغل 💪",
  ],
  feedback: [
    "حلو كتير 😍 بس بدنا اللون الأزرق يكون أغمق شوي",
    "ممكن تكبر الخط بالموبايل؟ الختيارية ما بيشوفوا منيح 😂",
    "تمام كل إشي، بس اللوغو طالع صغير",
    "جربناه وماشي معنا، يعطيك العافية",
  ],
  fixAck: ["ولا يهمك، بعدلها اليوم", "تم ✅", "على راسي، خلص بتشوفوها بالليل", "اوكي ثواني وبتكون جاهزة"],
  delivery: [
    "الحمد لله خلصنا 🎉 كل إشي live هسا، وبعتلكم بيانات الدخول للـ admin panel عالإيميل",
    "تم التسليم ✅ الموقع شغال على الـ domain، وعملت backup كامل",
    "خلصنا! نزلت النسخة النهائية وعملتلكم شرح فيديو قصير كيف تستعملوه",
  ],
  deliveryThanks: ["يسلمو ايديك، شغل نظيف 👏", "والله مبدع، الزباين انبسطوا عليه", "تسلم يا غالي ❤️ كله تمام"],
  invoiceNote: [
    "هاي الفاتورة، والدفع على CliQ alias: {alias}",
    "بعتلكم الفاتورة 👇 التحويل على الكليك: {alias}",
    "تفضلوا الفاتورة النهائية، المتبقي {due} دينار على {alias}",
  ],
  paid: [
    "حولتلك {amount} هسا على الكليك ✅",
    "تم التحويل {amount} دينار، بتوصلك إن شاء الله",
    "حولنا المبلغ {amount} 👍",
  ],
  paidCombined: ["حولتلك تبع الفاتورتين مع بعض {amount} دينار ✅", "دفعنا الفاتورتين بتحويلة وحدة: {amount}"],
  paidThanks: ["وصلت، شكراً كتير 🙏 بالتوفيق إلكم", "وصل التحويل ✅ تشرفت بالشغل معكم", "تمام وصل، أي إشي بتحتاجوه أنا موجود"],

  // ---- Scenario B: the developer buys something ----
  buyAsk: [
    "مرحبا، بدي أسأل عن {item}، متوفر؟ وقديش سعره؟",
    "هلا، بدي أجدد {item}، شو العروض عندكم هالفترة؟",
    "مساء الخير، عندكم {item}؟",
  ],
  vendorPrice: [
    "أهلاً وسهلاً 🙏 متوفر، سعره {price} دينار",
    "هلا فيك، عنا عرض هالشهر: {price} دينار بدل {old}",
    "متوفر، والسعر {price} شامل الضريبة",
  ],
  buyQuestion: ["في ضمان؟", "بتوصلوا لعمان؟", "بتقبلوا كليك؟", "التفعيل فوري ولا بياخد وقت؟"],
  vendorAnswer: ["أكيد، ضمان سنة", "التوصيل لعمان مجاني", "أكيد بنقبل كليك", "التفعيل خلال ساعة من الدفع"],
  buyOrder: ["تمام بدي {qty}", "خلص اعتمد، كيف بدفع؟", "ماشي بدي آخذه"],
  vendorPayInfo: ["حول المبلغ {total} دينار على CliQ alias: {alias} وابعتلي صورة التحويل", "المجموع {total}، الكليك تبعنا {alias}"],
  buyPaid: ["حولت ✅", "تم التحويل {total} دينار", "حولت هسا، شوف وصل؟"],
  vendorConfirm: ["وصل، شكراً إلك 🙏 هاي الفاتورة", "تم استلام المبلغ ✅ تفضل الإيصال"],
  vendorDelivery: [
    "الطلب طلع مع المندوب، بوصلك بكرا إن شاء الله",
    "تم التفعيل، الـ credentials بعتناها عالإيميل",
    "جاهز للاستلام من المحل أي وقت",
  ],
  buyThanks: ["يعطيكم العافية 🙏", "شكراً، تعامل محترم", "تمام وصل، شكراً"],

  emojis: ["👍", "🙏", "😅", "🔥", "✅", "🙌", "😂", "❤️", "💪", "👌"],
} as const;

export type Stage = keyof typeof T;

/**
 * Services the developer offers: title, features clients ask for, priced line items (JOD), and
 * service-specific lines. `generic: false` means the generic build-project lines don't fit
 * (e.g. maintenance has no "first design" or "delivery on the domain").
 */
export type Service = {
  title: string;
  titleEn: string;
  features: readonly string[];
  items: readonly (readonly [string, number, number])[];
  progress: readonly string[];
  feedback: readonly string[];
  delivery?: readonly string[];
  clarify?: readonly string[];
  generic?: boolean;
};

export const SERVICES: readonly Service[] = [
  {
    title: "موقع إلكتروني",
    titleEn: "Company website",
    features: ["صفحة للخدمات والأسعار", "فورم تواصل", "ربط مع Google Maps", "صفحة عربي وانجليزي", "SEO أساسي"],
    items: [["UI/UX design", 150, 300], ["Website development (Next.js)", 300, 700], ["Hosting & domain setup", 40, 90]],
    progress: ["الـ mobile version صارت responsive، جربوها من التلفون", "خلصت صفحة الخدمات وفورم التواصل، ضايل الـ SEO"],
    feedback: ["صفحة الأسعار مش واضحة كتير، ممكن نرتبها بجدول؟", "بدنا رقم التلفون يطلع فوق بكل الصفحات"],
  },
  {
    title: "نظام حجوزات أونلاين",
    titleEn: "Online booking system",
    features: ["حجز مواعيد أونلاين", "تذكير بالـ SMS", "dashboard للمواعيد", "ربط مع WhatsApp"],
    items: [["Booking system development", 400, 900], ["SMS/WhatsApp notifications integration", 80, 200], ["Admin dashboard", 150, 350]],
    progress: ["خلصت الـ backend تقريباً، ضايل الـ admin panel", "ربطت تذكير الـ WhatsApp وجربته على رقمي ✅", "صار في bug صغير بالـ login وصلحته ✅"],
    feedback: ["الصفحة الرئيسية ممتازة، بس زر الحجز مش واضح", "بدنا نقدر نسكّر أيام العطل من الـ dashboard"],
  },
  {
    title: "تطبيق موبايل",
    titleEn: "Mobile app",
    features: ["تسجيل دخول للزباين", "push notifications", "طلب أونلاين", "برنامج نقاط وولاء"],
    items: [["Flutter app (Android + iOS)", 900, 2000], ["Backend API", 400, 900], ["App store publishing", 50, 120]],
    progress: ["ربطت الـ payment gateway وعم بجرب عليها", "بعتلكم نسخة TestFlight للآيفون و APK للأندرويد", "الـ push notifications شغالة ✅"],
    feedback: ["التطبيق سريع 👌 بس صفحة الطلب فيها خطوات كتير", "على الآيفون الخط طالع صغير شوي"],
    delivery: ["التطبيق نزل على Google Play و App Store 🎉 بعتلكم الروابط"],
  },
  {
    title: "نظام إدارة مخزون",
    titleEn: "Inventory management system",
    features: ["إدارة المخزون", "barcode scanner", "تقارير وتصدير Excel", "صلاحيات للموظفين"],
    items: [["Inventory system development", 500, 1100], ["Barcode scanner integration", 80, 180], ["Reports & Excel export", 100, 250]],
    progress: ["الـ barcode scanner صار يقرأ تمام، جربته على 20 صنف", "خلصت تقارير المبيعات والتصدير لـ Excel", "عملت صلاحيات منفصلة للكاشير والمدير"],
    feedback: ["بدنا التقرير يطلع كمان حسب الفرع", "ممكن تنبيه لما صنف يقرب يخلص؟"],
    delivery: ["النظام شغال على أجهزة المحل ✅ وعملت تدريب سريع للموظفين"],
  },
  {
    title: "صفحة هبوط (landing page)",
    titleEn: "Landing page",
    features: ["تصميم سريع وخفيف", "فورم لتسجيل الزباين", "ربط مع Facebook Pixel"],
    items: [["Landing page design & development", 120, 300], ["Analytics & pixel setup", 30, 80]],
    progress: ["ركبت الـ Facebook Pixel والـ analytics", "الصفحة بتفتح بأقل من ثانية 🚀"],
    feedback: ["بدنا نغير صورة الغلاف لصورة العرض الجديد", "الفورم بدنا يطلب رقم التلفون إجباري"],
  },
  {
    title: "صيانة ودعم فني شهري",
    titleEn: "Monthly maintenance",
    features: ["تحديثات أمنية", "backup أسبوعي", "تعديلات صغيرة"],
    items: [["Monthly maintenance & support", 50, 150]],
    generic: false,
    clarify: ["الوصول للـ hosting panel عندكم ولا عندي؟", "في إشي معين مضايقكم بالموقع هالفترة؟"],
    progress: ["عملت update للـ plugins والـ security patches ✅", "الـ backup الأسبوعي صار تلقائي", "صلحت مشكلة البطء بالصفحة الرئيسية", "عدلت الأسعار بالموقع زي ما طلبتوا"],
    feedback: ["الموقع صار أسرع، يسلمو", "ممكن تضيفلنا بانر العرض الجديد؟", "في رسالة error بتطلع أحياناً عند الدفع"],
    delivery: ["خلصت كل شغل هالشهر ✅ وبعتلكم report بكل اللي انعمل"],
  },
];

/** What the developer buys from each vendor category: [description, min JOD, max JOD]. */
export const PURCHASES: Record<string, readonly (readonly [string, number, number])[]> = {
  "Web hosting": [["VPS 4GB RAM - 12 months", 90, 180], ["Shared hosting - 1 year", 25, 60], ["SSL certificate - 1 year", 15, 45]],
  "Domain registrar": [[".com domain - 1 year", 9, 15], [".jo domain - 1 year", 25, 40], ["Domain transfer", 8, 14]],
  "Electronics store": [["Mechanical keyboard", 45, 120], ['27" 4K monitor', 180, 320], ["USB-C hub", 18, 40], ["Laptop stand", 15, 35]],
  "Design studio": [["Logo design", 60, 200], ["App UI kit (Figma)", 80, 250], ["Social media templates pack", 40, 100]],
  "Training center": [["Advanced React course", 120, 250], ["AWS Cloud Practitioner prep course", 150, 300], ["Flutter bootcamp", 200, 400]],
  "Software reseller": [["JetBrains All Products Pack - 1 year", 180, 220], ["Windows 11 Pro license", 90, 140], ["Adobe Creative Cloud - 1 month", 35, 50]],
};
