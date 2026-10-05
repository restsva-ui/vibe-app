const tg=window.Telegram?.WebApp;
function syncTelegramViewport(){
  const root=document.documentElement;
  const safe=tg?.safeAreaInset||{};
  const content=tg?.contentSafeAreaInset||{};
  const top=Math.max(Number(safe.top)||0,Number(content.top)||0);
  const bottom=Math.max(Number(safe.bottom)||0,Number(content.bottom)||0);
  const stable=Math.max(320,Number(tg?.viewportStableHeight)||window.innerHeight||document.documentElement.clientHeight||720);
  const sheetTop=Math.max(top,Number(tg?.isFullscreen?12:88));
  root.style.setProperty("--tg-safe-top",top+"px");
  root.style.setProperty("--tg-safe-bottom",bottom+"px");
  root.style.setProperty("--tg-sheet-top",sheetTop+"px");
  root.style.setProperty("--tg-viewport-height",stable+"px");
  root.style.setProperty("--chat-viewport-height",Math.min(stable,window.visualViewport?.height||window.innerHeight||stable)+"px");
}
if(tg){
  tg.ready();tg.expand();tg.setHeaderColor("#0c1014");tg.setBackgroundColor("#0c1014");
  syncTelegramViewport();
  tg.onEvent?.("safeAreaChanged",syncTelegramViewport);
  tg.onEvent?.("contentSafeAreaChanged",syncTelegramViewport);
  tg.onEvent?.("viewportChanged",syncTelegramViewport);
}
window.addEventListener("resize",syncTelegramViewport);
window.visualViewport?.addEventListener("resize",syncTelegramViewport);
const tuser=tg?.initDataUnsafe?.user;const $=id=>document.getElementById(id),store=(k,v)=>localStorage.setItem(k,JSON.stringify(v)),load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};


const I18N_PAIRS=[
  ["Інтереси","Interests"],["Мої інтереси","My interests"],["Обери до 8 — так легше знайти своїх людей.","Choose up to 8 to find your people."],
  ["Можна обрати до 8 інтересів.","You can choose up to 8 interests."],["Показувати мій район на карті","Show my area on the map"],
  ["Добровільно. Інші бачитимуть лише приблизний район.","Optional. Others will see only an approximate area."],
  ["Обрати район на карті","Choose an area on the map"],["Район обрано. Позначка приблизна.","Area selected. The marker is approximate."],
  ["Район ще не обрано.","No area selected yet."],["Обери район на карті або вимкни показ на карті.","Choose an area or turn off map visibility."],
  ["Не вдалося зберегти анкету. Спробуй ще раз.","Could not save your profile. Please try again."],
  ["Карта","Map"],["Наблизити","Zoom in"],["Віддалити","Zoom out"],["Обери свій район","Choose your area"],["Люди на карті","People on the map"],
  ["Наведи карту на район. Інші бачитимуть лише приблизну ділянку в кілька кілометрів.","Move the map to your area. Others will see only an approximate area a few kilometres wide."],
  ["Позначки добровільні й приблизні. На карті — люди з активним VYBE NOW.","Markers are optional and approximate. The map shows people with an active VYBE NOW."],
  ["Місто на карті","City on the map"],["Перейти до міста","Go to a city"],["Лише зі спільними інтересами","Shared interests only"],
  ["Обрати цей район","Choose this area"],["Виділена ділянка — район, який побачать інші.","The highlighted area is what others will see."],
  ["OpenStreetMap отримує IP-адресу та ділянку карти, яку ти переглядаєш.","OpenStreetMap receives your IP address and the map area you view."],
  ["Підкладка карти недоступна. Анкети можна відкрити зі списку.","Map tiles are unavailable. You can open profiles from the list."],
  ["Спільні інтереси: ","Shared interests: "],["Назад до карти","Back to the map"],["Надіслати VYBE","Send VYBE"],["VYBE надіслано","VYBE sent"],
  ["У цій ділянці поки немає активних анкет. Зміни район або фільтри.","No active profiles in this area yet. Change the area or filters."],
  ["Не вдалося завантажити карту людей. Спробуй ще раз.","Could not load people on the map. Please try again."],
  ["Не вдалося відкрити карту. Перевір з’єднання й спробуй ще раз.","Could not open the map. Check your connection and try again."],
  ["Показано до 100 анкет. Наблизь карту для точнішого пошуку.","Showing up to 100 profiles. Zoom in to narrow the search."],
  ["Анкет у цій ділянці: ","Profiles in this area: "],["Будь-який з обраних інтересів","Any selected interest"],
  ["Додай інтереси в анкету, щоб шукати спільні.","Add interests to your profile to find shared ones."],
  ["Твій вайб зараз","Your vibe right now"],["Зберегти","Save"],
  ["Запросити друзів","Invite friends"],["Безпека та приватність","Safety & privacy"],
  ["Заблоковані користувачі","Blocked users"],["Підтримка VYBE","VYBE Support"],
  ["Налаштування","Settings"],["Фінанси VYBE","VYBE Finance"],["Модерація VYBE","VYBE Moderation"],
  ["Мої бонуси","My bonuses"],["Обери вайб","Choose your vibe"],["Навігація","Navigation"],
  ["Приватний чат","Private chat"],["Закрити","Close"],["Сповіщення","Notifications"],
  ["Лайкни анкету — взаємний VYBE відкриє чат.","Like a profile — a mutual VYBE opens a chat."],
  ["Тут будуть твої розмови після взаємного VYBE.","Your conversations will appear here after a mutual VYBE."],
  ["Знайомства, флірт, дружба та приватне спілкування для дорослих.","Dating, flirting, friendship and private communication for adults."],
  ["Мені виповнилося 18 років, я приймаю правила спільноти.","I am 18 or older and I accept the community rules."],
  ["Заборонені неповнолітні, примус, шантаж, продаж сексуальних послуг і незаконний контент.","Minors, coercion, blackmail, sexual services and illegal content are prohibited."],
  ["Створи свою анкету","Create your profile"],
  ["Анкета синхронізується з VYBE. Не додавай приватні контактні дані в опис.","Your profile syncs with VYBE. Do not put private contact details in your bio."],
  ["Коротко й живо — що варто знати про тебе?","A short, lively intro — what should people know about you?"],
  ["Чоловік / Жінка / Інше","Man / Woman / Other"],
  ["Напр. жінок 25–40","E.g. women 25–40"],
  ["Зберегти →","Save →"],
  ["Ім’я","Name"],["Вік","Age"],["Місто","City"],["Я","I am"],["Кого шукаю","Looking for"],["Про себе","About me"],
  ["⚡ VYBE NOW не задано","⚡ VYBE NOW not set"],
  ["Покажи, чого хочеш саме зараз","Show what you want right now"],
  ["Задати","Set"],["Змінити","Change"],
  ["Люди по твоєму вайбу","People matching your vibe"],
  ["Фільтри","Filters"],["Мої збіги","My matches"],["Чати","Chats"],
  ["Твій профіль","Your profile"],["Заповни анкету.","Complete your profile."],["Редагувати профіль","Edit profile"],
  ["Додати фото","Add photo"],["Змінити фото","Change photo"],["Видалити","Remove"],
  ["🔗 Запросити друзів","🔗 Invite friends"],["🛡 Безпека та приватність","🛡 Safety & privacy"],
  ["🚫 Заблоковані користувачі","🚫 Blocked users"],["⚑ Підтримка VYBE","⚑ VYBE Support"],["Потрібно поскаржитися на конкретного користувача? Відкрий його анкету або чат → ⋯ → «Поскаржитися».","Need to report a specific user? Open their profile or chat → ⋯ → “Report”."],["Звернення тут — це технічна або платіжна підтримка, а не скарга на користувача.","Requests here are for technical or payment support, not reports about another user."],["⚙ Налаштування","⚙ Settings"],
  ["Вайб","Vibe"],["Збіги","Matches"],["Профіль","Profile"],["Усе","All"],
  ["Поговорити","Talk"],["Флірт","Flirt"],["Дружба","Friendship"],["Голос","Voice"],["Зустріч","Meet"],
  ["● автооновлення","● auto refresh"],["друкує…","typing…"],["realtime • приватний чат","realtime • private chat"],["автооновлення • приватний чат","auto refresh • private chat"],
  ["Не вдалося завантажити реферальну статистику.","Could not load referral statistics."],
  ["Запросити друзів 🔗","Invite friends 🔗"],["Запрошено: ","Invited: "],[" • Активували анкету: "," • Activated profile: "],
  ["Нагороди 🎁","Rewards 🎁"],[" активн."," active"],["Отримано","Unlocked"],["Прогрес: ","Progress: "],
  ["Зараховуються лише друзі, які створили анкету 18+.","Only friends who create an 18+ profile count."],
  ["Поділитися запрошенням","Share invite"],["Скопіювати посилання","Copy link"],
  ["Приєднуйся до VYBE 💜. Відкрий бота та натисни кнопку запуску VYBE.","Join VYBE 💜. Open the bot and tap the button to launch VYBE."],
  ["Посилання скопійовано ✅","Link copied ✅"],
  ["Фейкова анкета / видає себе за іншу людину","Fake profile / impersonation"],["Спам або шахрайство","Spam or scam"],
  ["Образи, переслідування або шантаж","Abuse, harassment or blackmail"],["Можливо, користувачу немає 18 років","User may be under 18"],
  ["Продаж або купівля сексуальних послуг","Buying or selling sexual services"],["Незаконний або небезпечний контент","Illegal or dangerous content"],["Інша причина","Other reason"],
  ["Безпека","Safety"],["Безпека 🛡","Safety 🛡"],["Дії щодо ","Actions for "],["Заблокувати ","Block "],["? Ви більше не бачитимете одне одного у VYBE.","? You will no longer see each other in VYBE."],["⚑ Поскаржитися","⚑ Report"],["🚫 Заблокувати","🚫 Block"],
  ["Після блокування ви не бачитимете одне одного у VYBE, а чат і нові лайки стануть недоступними.","After blocking, you will no longer see each other in VYBE, and chat and new likes will be disabled."],
  ["Не вдалося заблокувати користувача.","Could not block this user."],["Користувача заблоковано.","User blocked."],
  ["Поскаржитися ⚑","Report ⚑"],["Скарга на ","A report about "],[" буде передана на модерацію."," will be sent for moderation."],
  ["Причина","Reason"],["Деталі","Details"],["Коротко опиши, що сталося. Не додавай зайві особисті дані.","Briefly describe what happened. Do not add unnecessary personal data."],
  ["Також заблокувати цього користувача","Also block this user"],["Надіслати скаргу","Submit report"],
  ["Не вдалося надіслати скаргу.","Could not submit the report."],["Скаргу надіслано, користувача заблоковано.","Report submitted and user blocked."],["Скаргу надіслано.","Report submitted."],
  ["Заблоковані користувачі 🚫","Blocked users 🚫"],["Завантаження…","Loading…"],["Не вдалося завантажити список.","Could not load the list."],
  ["Користувач","User"],["Розблокувати","Unblock"],["Тут поки нікого немає.","No one here yet."],["Не вдалося розблокувати.","Could not unblock."],
  ["не активний","inactive"],["🔦 активний ще ","🔦 active for "],[" хв."," min"],[" • VYBE+ до: "," • VYBE+ until: "],
  ["Spotlight не списано. Перевір баланс і спробуй ще раз.","Spotlight was not used. Check your balance and try again."],
  ["Spotlight активовано на 30 хвилин ✨","Spotlight activated for 30 minutes ✨"],
  ["Привіт 👋","Hi 👋"],["Привіт, ","Hi, "],["Київ","Kyiv"],["Новий користувач VYBE","New VYBE user"],["● онлайн","● online"],["нещодавно","recently"],["✓ верифіковано","✓ verified"],
  ["Відкрий VYBE через Telegram-бота","Open VYBE from the Telegram bot"],
  ["Не вдалося підтвердити Telegram-авторизацію. Відкрий VYBE заново через бота.","Could not verify Telegram authorization. Reopen VYBE from the bot."],
  ["Входимо…","Entering…"],["Увійти","Enter"],["Вкажи ім’я та вік 18+.","Enter your name and age (18+)."],["Шукаю: ","Looking for: "],["Без опису","No bio"],
  ["Фото профілю оновлено ✅","Profile photo updated ✅"],["Не вдалося завантажити фото. Обери JPG/PNG/WebP до 12 МБ.","Could not upload the photo. Choose a JPG/PNG/WebP file up to 12 MB."],
  ["Видалити фото профілю?","Remove profile photo?"],["Не вдалося видалити фото.","Could not remove the photo."],
  ["Фільтри 🔎","Filters 🔎"],["Вік від","Age from"],["до","to"],["Напр. Київ","E.g. Kyiv"],["Лише онлайн зараз","Online now only"],["Лише верифіковані","Verified only"],["Застосувати","Apply"],["Скинути фільтри","Reset filters"],
  ["Активний ще ","Active for "],[" год."," h"],
  ["Твій VYBE NOW ⚡","Your VYBE NOW ⚡"],["Що ти хочеш саме зараз?","What do you want right now?"],["На скільки?","For how long?"],
  ["1 година","1 hour"],["3 години","3 hours"],["До ранку","Until morning"],["До вечора","Until evening"],["Увімкнути VYBE NOW","Enable VYBE NOW"],
  ["Мої бонуси ✨","My bonuses ✨"],["Активувати Spotlight на 30 хв","Activate Spotlight for 30 min"],["SuperVYBE витрачається кнопкою ✦ на реальній анкеті.","Use SuperVYBE with the ✦ button on a real profile."],
  ["VYBE працює тільки для 18+. Блокування та скарги вже захищені серверною перевіркою: заблоковані користувачі не бачать одне одного у пошуку, збігах і чатах.","VYBE is for adults 18+ only. Blocks and reports are enforced server-side: blocked users cannot see each other in discovery, matches or chats."],
  ["🚫 Мої блокування","🚫 My blocked users"],["Якщо бачиш погрози, шантаж, неповнолітнього користувача, незаконний контент або пропозиції сексуальних послуг — надішли скаргу з профілю/чату.","If you see threats, blackmail, a minor, illegal content or offers of sexual services, report it from the profile or chat."],
  ["Спочатку обери свій вайб.","Choose your vibe first."],["Анкет за цим вайбом поки немає.","No profiles match this vibe yet."],["Спробуй інший фільтр.","Try another filter."],["Зараз немає активних VYBE NOW за цими умовами.","No active VYBE NOW profiles match these filters right now."],["Спробуй інший вайб або фільтр.","Try another vibe or filter."],["Зараз нікого з таким вайбом немає.","No one with this vibe is active right now."],["Зміни VYBE NOW або спробуй інші умови.","Change VYBE NOW or try different filters."],["Зараз немає активних анкет.","No active profiles right now."],["Нові активні VYBE NOW з’являться тут.","New active VYBE NOW profiles will appear here."],["⚡ Задати VYBE NOW","⚡ Set VYBE NOW"],["⚡ Змінити VYBE NOW","⚡ Change VYBE NOW"],["↺ Скинути фільтри","↺ Reset filters"],["↻ Оновити пошук","↻ Refresh discovery"],["активний ще","active for"],["хв.","min"],["онлайн","online"],["Верифіковано","Verified"],["Пропустити","Skip"],
  ["Це демо-анкета. Реальна дія працює тільки для реальних користувачів.","This is a demo profile. Real actions work only with real users."],
  ["SuperVYBE не списано. Спробуй ще раз.","SuperVYBE was not used. Try again."],["Не вдалося надіслати VYBE. Спробуй ще раз.","Could not send VYBE. Try again."],
  ["У вас взаємний VYBE 💜","You have a mutual VYBE 💜"],["SuperVYBE надіслано ✦","SuperVYBE sent ✦"],
  ["Взаємний VYBE","Mutual VYBE"],["Поки немає взаємних збігів.","No mutual matches yet."],["Відкрити приватний чат","Open private chat"],["Новий взаємний VYBE ✨","New mutual VYBE ✨"],["Написати зараз","Message now"],["Продовжити перегляд","Keep browsing"],["Надіслано","Sent"],["Прочитано","Read"],["Чати з’являться після взаємних збігів.","Chats will appear after mutual matches."],
  ["Не вдалося відкрити чат.","Could not open chat."],["Ти","You"],["Почни розмову 👋","Start the conversation 👋"],["Напиши повідомлення…","Write a message…"],["Надіслати","Send"],["Не вдалося надіслати повідомлення.","Could not send message."],
  ["Приватність 🔐","Privacy 🔐"],
  ["VYBE використовує Telegram-авторизацію та зберігає лише дані, потрібні для роботи сервісу: Telegram ID, анкету, фото, VYBE NOW, лайки, збіги, приватні повідомлення, блокування, скарги та бонуси.","VYBE uses Telegram authorization and stores only data needed to operate the service: Telegram ID, profile, photo, VYBE NOW, likes, matches, private messages, blocks, reports and rewards."],
  ["Фото зберігаються у Supabase Storage. Тексти приватних повідомлень не передаються в Realtime Broadcast — через realtime передаються лише технічні сигнали про зміни.","Photos are stored in Supabase Storage. Private message text is not sent through Realtime Broadcast — realtime carries only technical change signals."],
  ["Ти можеш видалити акаунт у Налаштуваннях. Після підтвердження профіль і пов’язані дані видаляються з активної бази.","You can delete your account in Settings. After confirmation, the profile and related data are removed from the active database."],
  ["Правила спільноти 🛡","Community rules 🛡"],["VYBE — лише для повнолітніх 18+.","VYBE is for adults 18+ only."],
  ["Заборонені: примус, шантаж, переслідування, шахрайство, видавання себе за іншу людину, участь неповнолітніх, продаж сексуальних послуг та незаконний контент.","Prohibited: coercion, blackmail, harassment, scams, impersonation, minors, sexual services and illegal content."],
  ["Для небезпечного або підозрілого профілю використовуй «Поскаржитися» або «Заблокувати».","For a dangerous or suspicious profile, use Report or Block."],
  ["Допомога ⚑","Help ⚑"],["Якщо проблема стосується конкретного користувача, відкрий його анкету або чат → ⋯ → «Поскаржитися».","If the issue concerns a specific user, open their profile or chat → ⋯ → Report."],
  ["Технічні помилки зараз фіксуємо під час beta-тестування. Не надсилай у скаргах паролі, банківські дані чи інші секрети.","We are logging technical issues during beta testing. Do not include passwords, banking details or other secrets in reports."],
  ["ВИДАЛИТИ","DELETE"],["Для підтвердження введи слово «ВИДАЛИТИ».","To confirm, enter the word DELETE."],["Видаляємо…","Deleting…"],["Видалити акаунт назавжди","Delete account permanently"],
  ["Не вдалося видалити акаунт. Спробуй ще раз.","Could not delete the account. Try again."],["Акаунт VYBE та пов’язані дані видалено.","Your VYBE account and related data were deleted."],
  ["Видалити акаунт","Delete account"],["Ця дія незворотна. Будуть видалені анкета, фото, VYBE NOW, лайки, збіги, повідомлення, блокування, скарги, звернення в підтримку, реферальні дані та бонуси. Мінімальні записи про завершені платежі можуть зберігатися окремо для повернення Stars і фінансової звірки.","This cannot be undone. Your profile, photo, VYBE NOW, likes, matches, messages, blocks, reports, support requests, referral data and rewards will be deleted. Minimal records of completed payments may be retained separately for Stars refunds and financial reconciliation."],
  ["Для підтвердження введи ","To confirm, enter "],["Скасувати","Cancel"],
  ["Налаштування ⚙","Settings ⚙"],["🔐 Приватність","🔐 Privacy"],["🛡 Правила спільноти","🛡 Community rules"],["📄 Умови користування","📄 Terms of Use"],["Повна політика приватності","Full Privacy Policy"],["Повні правила спільноти","Full Community Rules"],["Умови","Terms"],["Правила","Rules"],["Приватність","Privacy"],["🗑 Видалити акаунт","🗑 Delete account"],
  ["Мова","Language"],["Аналітика продукту","Product analytics"],["Допомагає покращувати VYBE. Без текстів чатів, bio, імен чи міста.","Helps improve VYBE. No chat text, bio, names or city."],["Увімкнено","On"],["Вимкнено","Off"],["Українська","Українська"],["English","English"],
  ["VYBE+ на 3 дні","VYBE+ for 3 days"],["Магазин Stars ⭐","Stars Store ⭐"],["Купити за ","Buy for "],["Оплата відкриється у Telegram.","Payment will open in Telegram."],["Не вдалося створити рахунок.","Could not create the invoice."],["Платежі доступні лише всередині Telegram.","Payments are available only inside Telegram."],["Оплата успішна ⭐ Покупку зараховано.","Payment successful ⭐ Your purchase was added."],["Платіж обробляється. Баланс оновиться автоматично.","Payment is processing. Your balance will update automatically."],["Оплату скасовано.","Payment cancelled."],["Оплата не пройшла.","Payment failed."],["Перевіряємо покупку…","Checking your purchase…"],["Хто лайкнув мене","Who liked me"],["VYBE+ відкриває список людей, які вже лайкнули тебе.","VYBE+ unlocks the list of people who already liked you."],["Поки немає нових лайків.","No new likes yet."],["Лайкнути у відповідь","Like back"],["Потрібен активний VYBE+.","Active VYBE+ is required."],["Завантажуємо магазин…","Loading store…"],["Покупка зарахована","Purchase added"],["Зірок","Stars"],["Я приймаю Умови користування для покупки цифрових товарів.","I accept the Terms of Use for digital purchases."],["Перед оплатою прийми Умови користування.","Accept the Terms of Use before paying."],["Очікуємо Telegram…","Waiting for Telegram…"],["Повернутися у VYBE","Return to VYBE"],["Тест успішний ✅ 1 Star повернуто.","Test successful ✅ 1 Star was refunded."],["Покупка успішна ⭐","Purchase successful ⭐"],["Фінанси VYBE ⭐","VYBE Finance ⭐"],["Баланс бота","Bot balance"],["24 години","24 hours"],["7 днів","7 days"],["30 днів","30 days"],["Весь час","All time"],["Валові","Gross"],["Повернення","Refunds"],["Чисті","Net"],["Оплачені","Paid"],["Звірка Telegram ↔ VYBE","Telegram ↔ VYBE reconciliation"],["Останні покупки","Recent purchases"],["Останні транзакції Telegram","Recent Telegram transactions"],["Оновити","Refresh"],["Повернути Stars","Refund Stars"],["Повернути ","Refund "],[" Stars користувачу?"," Stars to the user?"],["Повернення виконано ✅","Refund completed ✅"],["Не вдалося повернути Stars.","Could not refund Stars."],["Джерело істини для поточного балансу — Telegram.","Telegram is the source of truth for the current balance."],["Збігів","Matched"],["з","of"],["Немає транзакцій.","No transactions."],["Немає покупок.","No purchases."],["Продажі за продуктами","Sales by product"],["Статуси замовлень","Order statuses"],["Технічні спроби","Technical attempts"],["Історія повернень","Refund history"],["Автоматично","Automatic"],["Власник","Owner"],["Експорт продажів","Sales export"],["Завантажити CSV","Download CSV"],["Скопіювати CSV","Copy CSV"],["CSV скопійовано ✅","CSV copied ✅"],["Не вдалося експортувати дані.","Could not export data."],["Виведення Stars","Stars withdrawal"],["Виведення виконується власником через Telegram / Fragment. VYBE не зберігає 2FA і не запускає виведення від імені бота.","Withdrawal is performed by the owner through Telegram / Fragment. VYBE does not store 2FA and does not initiate withdrawals on behalf of the bot."],["Як вивести","How to withdraw"],["Спроб","Attempts"],["Успішних","Successful"],["Відкритих","Pending"],["Помилок","Failed"],["Прострочених","Expired"],["Скасованих","Cancelled"],["Останні замовлення","Recent orders"],["Оплата користувача","User payment"],["Повернення користувачу","Refund to user"],["Вхідна транзакція","Incoming transaction"],["Вихідна транзакція","Outgoing transaction"],["Модерація VYBE 🛡","VYBE Moderation 🛡"],["Нова скарга","New report"],["Скаржник","Reporter"],["Користувач зі скарги","Reported user"],["Фейковий профіль","Fake profile"],["Спам","Spam"],["Переслідування або домагання","Harassment"],["Підозра на неповнолітнього","Suspected minor"],["Сексуальні послуги","Sexual services"],["Незаконний або небезпечний контент","Illegal or dangerous content"],["Інша причина","Other reason"],["Відхилено","Dismissed"],["Відхилити скаргу","Dismiss report"],["Позначити вирішеною","Mark resolved"],["Обмежити акаунт","Restrict account"],["Відновити акаунт","Restore account"],["Акаунт обмежено","Account restricted"],["Активний акаунт","Active account"],["Причина обмеження","Restriction reason"],["Обмежити цього користувача у VYBE? Він зникне з пошуку, збігів і не зможе писати повідомлення.","Restrict this user in VYBE? They will disappear from discovery and matches and will not be able to send messages."],["Відновити доступ цього користувача до VYBE?","Restore this user's access to VYBE?"],["Модераційний статус оновлено ✅","Moderation status updated ✅"],["Не вдалося оновити модерацію.","Could not update moderation."],["Доступ обмежено ✅","Access restricted ✅"],["Доступ відновлено ✅","Access restored ✅"],["Твій акаунт тимчасово обмежено","Your account is temporarily restricted"],["Соціальні функції VYBE недоступні, поки обмеження активне. Ти можеш звернутися у підтримку або видалити акаунт.","VYBE social features are unavailable while the restriction is active. You can contact support or delete your account."],["Звернутися у підтримку","Contact support"],["Анкета користувача","User profile"],["Переглянути анкету","View profile"],["Назад до чату","Back to chat"],["Написати повідомлення","Send message"],["У вас вже взаємний VYBE 💜","You already have a mutual VYBE 💜"],["Цей користувач уже у твоїх збігах.","This user is already one of your matches."],["Профіль недоступний.","Profile is unavailable."],["Підтримка VYBE ⚑","VYBE Support ⚑"],["Нове звернення","New request"],["Загальне питання","General question"],["Проблема з оплатою","Payment issue"],["Опиши проблему","Describe the issue"],["Надіслати у підтримку","Send to support"],["Мої звернення","My requests"],["Звернення надіслано ✅","Request sent ✅"],["Не вдалося надіслати звернення.","Could not send the request."],["Зачекай трохи перед наступним зверненням.","Please wait before sending another request."],["Відкрите","Open"],["В роботі","In review"],["Вирішено","Resolved"],["Відповідь підтримки","Support reply"],["Це звернення вже вирішено.","This request is already resolved."],["Центр підтримки","Support Center"],["Відкриті","Open"],["В роботі","Reviewed"],["Вирішені","Resolved"],["Платіжні","Payment"],["Загальні","General"],["Остання покупка","Latest purchase"],["Відкрити звернення","Open request"],["Взяти в роботу","Mark reviewed"],["Відповісти й закрити","Reply & resolve"],["Закрити без відповіді","Resolve without reply"],["Повернути у відкриті","Reopen"],["Внутрішня нотатка","Internal note"],["Відповідь користувачу","Reply to user"],["Статус оновлено ✅","Status updated ✅"],["Не вдалося оновити звернення.","Could not update the request."],["Черга порожня.","Queue is empty."],["⚑ Підтримка VYBE","⚑ VYBE Support"],["«Взяти в роботу» змінює лише статус і не надсилає текст користувачу.","“Mark reviewed” only changes the status and does not send your reply to the user."],["Відповідь не буде втрачена.","Your draft reply will be preserved."],["Telegram-сповіщення","Telegram notifications"],["Лайки","Likes"],["Збіги","Matches"],["Повідомлення","Messages"],["Сповіщення не містять текстів приватних повідомлень.","Notifications never include private message text."],["Не вдалося оновити сповіщення.","Could not update notifications."],["Сповіщення оновлено ✅","Notifications updated ✅"],["Сповіщення 🔔","Notifications 🔔"],["Усі","All"],["Система","System"],["Новий лайк","New like"],["Новий SuperVYBE","New SuperVYBE"],["Хтось вподобав твою анкету.","Someone liked your profile."],["Тобі поставили VYBE 💜","Someone sent you a VYBE 💜"],["Хтось уже зацікавився твоєю анкетою.","Someone is already interested in your profile."],["VYBE+ покаже, хто саме це.","VYBE+ shows you exactly who it is."],["Подивитися хто — VYBE+","See who — VYBE+"],["Продовжити пошук","Keep browsing"],["Хтось надіслав тобі SuperVYBE.","Someone sent you a SuperVYBE."],["Взаємний VYBE 💜","Mutual VYBE 💜"],["У тебе нове повідомлення.","You have a new message."],["Підтримка відповіла на твоє звернення.","Support replied to your request."],["Доступ до акаунта обмежено.","Account access restricted."],["Доступ до VYBE відновлено.","VYBE access restored."],["Нових сповіщень немає.","No notifications yet."],["Чат недоступний.","Chat is unavailable."],["Відкрити","Open"],["🧪 Скинути тестовий match","🧪 Reset test match"],["Beta test tools","Beta test tools"],["Тимчасово: видаляє лише один owner-test match, взаємні лайки, чат і пов’язані сповіщення.","Temporary: deletes only one owner test match, mutual likes, chat, and related notifications."],["Тестовий match скинуто ✅","Test match reset ✅"],["Не вдалося скинути тестовий match.","Could not reset the test match."],["Для безпечного скидання має бути рівно один match.","Safe reset requires exactly one match."],["owner","owner"],["admin","admin"]
];

let currentLang=load("vybeLanguage",null)||(String(tuser?.language_code||"").toLowerCase().startsWith("en")?"en":"uk");
currentLang=currentLang==="en"?"en":"uk";

const I18N_SORTED=[...I18N_PAIRS].sort((a,b)=>Math.max(b[0].length,b[1].length)-Math.max(a[0].length,a[1].length));
const I18N_EXACT=new Set(["Я","до","Ти","Відкрите","Відкриті"]);
function uiText(value){
  let out=String(value??"");
  const exact=I18N_SORTED.find(([uk,en])=>out===uk||out===en);
  if(exact)return exact[currentLang==="en"?1:0];
  for(const [uk,en] of I18N_SORTED){
    const from=currentLang==="en"?uk:en;
    const to=currentLang==="en"?en:uk;
    if(!from||from===to)continue;
    if(I18N_EXACT.has(uk)){
      if(out.trim()===from)out=out.replace(from,to);
      continue;
    }
    if(out.includes(from))out=out.split(from).join(to);
  }
  return out;
}
function uiLocale(){return currentLang==="en"?"en-US":"uk-UA"}
function skipI18nElement(el){
  if(!el?.closest)return false;
  return !!el.closest(".msgBubble,.bio,.meta,#profileBio,#profileMeta,#profileName,#hello,.nameRow h2,.chatTitle h2,.blockedRow b,.chatOpen .itemMain small,.matchOpen .itemMain small,.msgSender,.avatar,.generatedAvatar,.chatAvatar,.msgAvatar,.userNameNoI18n,.mapShell,.interestPicker,.interestTags,.mediaShell");
}
function localizeDom(root=document){
  document.documentElement.lang=currentLang==="en"?"en":"uk";
  const target=root.nodeType===Node.ELEMENT_NODE?root:document;
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(skipI18nElement(node.parentElement))continue;
    const next=uiText(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  const elements=(target.matches?[target,...target.querySelectorAll("*")]:[...document.querySelectorAll("*")]);
  for(const el of elements){
    if(skipI18nElement(el))continue;
    for(const attr of ["placeholder","aria-label","title"]){
      if(el.hasAttribute?.(attr)){
        const before=el.getAttribute(attr),after=uiText(before);
        if(after!==before)el.setAttribute(attr,after);
      }
    }
  }
}
function showAlert(message,callback){
  const text=uiText(message);
  if(tg?.showAlert)return tg.showAlert(text,callback);
  window.alert(text);if(typeof callback==="function")callback();
}
function deleteToken(){return currentLang==="en"?"DELETE":"ВИДАЛИТИ"}
function setLanguage(next){
  currentLang=next==="en"?"en":"uk";
  store("vybeLanguage",currentLang);
  analyticsCapture("language_changed",{language:currentLang});
  localizeDom(document);
  if(profile)renderProfile();
  renderNow();
  renderCard();
  renderMatches();
  renderChats();
  setRealtimeBadge(realtimeConnected);
  $("hello").textContent=uiText("Привіт, ")+(tuser?.first_name||profile?.name||"");
  if(!sheet.classList.contains("hidden"))openSettings();
}
const languageObserver=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType===Node.ELEMENT_NODE)localizeDom(node);
      else if(node.nodeType===Node.TEXT_NODE&&!skipI18nElement(node.parentElement)){
        const next=uiText(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;
      }
    }
  }
});
languageObserver.observe(document.body,{childList:true,subtree:true});
queueMicrotask(()=>localizeDom(document));

const SUPABASE_URL="https://qifxxzpnuxchnkowxzgp.supabase.co";
const SUPABASE_KEY="sb_publishable_a-yy3lcgCXbDJosdQAWbPQ_bRLnN_LF";
const TELEGRAM_AUTH_URL=SUPABASE_URL+"/functions/v1/telegram-auth";
const POSTHOG_HOST="https://eu.i.posthog.com";
const POSTHOG_PROJECT_TOKEN="phc_pBHQg5iKgvw66j7dCYoRHZvZaTUhe5Gmu6SPU3fWmmVC";
let analyticsDistinctId=null;
let analyticsEnabled=load("vybeAnalytics",true)!==false;
function analyticsCapture(event,properties={},useBeacon=false){
  if(!analyticsEnabled||!analyticsDistinctId||!event)return;
  const payload={
    api_key:POSTHOG_PROJECT_TOKEN,
    event,
    properties:{
      distinct_id:analyticsDistinctId,
      "$process_person_profile":false,
      app_version:"0.9.48",
      platform:"telegram_mini_app",
      language:currentLang,
      ...properties,
    },
  };
  const body=JSON.stringify(payload);
  const url=POSTHOG_HOST+"/capture/";
  if(useBeacon&&navigator.sendBeacon){
    try{navigator.sendBeacon(url,new Blob([body],{type:"application/json"}));return}catch{}
  }
  fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true,credentials:"omit"}).catch(()=>{});
}

const realtimeClient=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
let realtimeUserTopic=null,realtimeUserChannel=null,realtimeUserChannelTopic=null,realtimeConnected=false;
const realtimeMatchChannels=new Map();
let chatMedia=null,chatRequestId=0;
let activeChat=null,chatRefreshTimer=null,socialRefreshTimer=null,typingStopTimer=null,incomingTypingTimer=null,lastTypingSentAt=0,localTypingActive=false;

function teardownSocialRealtime(){
  clearTimeout(chatRefreshTimer);
  clearTimeout(socialRefreshTimer);
  clearTimeout(typingStopTimer);
  clearTimeout(incomingTypingTimer);
  localTypingActive=false;
  activeChat=null;
  if(realtimeUserChannel&&realtimeClient){
    realtimeClient.removeChannel(realtimeUserChannel);
    realtimeUserChannel=null;
    realtimeUserChannelTopic=null;
  }
  for(const [,entry] of realtimeMatchChannels){
    realtimeClient?.removeChannel?.(entry.channel);
  }
  realtimeMatchChannels.clear();
  setRealtimeBadge(false);
}
function enterRestrictedMode(reason=null,{showNotice=true}={}){
  chatMedia?.stop();
  accountStatus="restricted";
  restrictionReason=reason||restrictionReason||null;
  remotePeople=[];matches=[];
  teardownSocialRealtime();
  try{renderCard();renderMatches();renderChats()}catch{}
  if(showNotice&&document.visibilityState==="visible"){
    setTimeout(()=>openRestrictionNotice(),0);
  }
}
async function secureApi(action,payload={}){
  const initData=tg?.initData;
  if(!initData)return {ok:false,status:401,error:"Відкрий VYBE через Telegram-бота"};
  try{
    const r=await fetch(TELEGRAM_AUTH_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},body:JSON.stringify({action,initData,...payload})});
    const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{}
    if(!r.ok||!body?.ok){
      const error=body?.error||text||"Server request failed";
      console.error("VYBE secure API",action,r.status,error);
      if(body?.error==="ACCOUNT_RESTRICTED"||body?.account_status==="restricted"){
        enterRestrictedMode(body?.restriction_reason||null);
      }
      return {ok:false,status:r.status,error,...(body||{})};
    }
    return {...body,status:r.status};
  }catch(e){console.error("VYBE secure API",action,e);return {ok:false,status:0,error:e?.message||"Network error"}}
}
async function verifyTelegramAuth(){return secureApi("me")}

function formatMessageTime(iso){
  if(!iso)return "";
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return "";
  return d.toLocaleTimeString(uiLocale(),{hour:"2-digit",minute:"2-digit"});
}
function formatChatListTime(iso){
  if(!iso)return "";
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";
  const n=new Date();
  if(d.toDateString()===n.toDateString())return formatMessageTime(iso);
  return d.toLocaleDateString(uiLocale(),{day:"2-digit",month:"2-digit"});
}
function scheduleSocialRefresh(delay=180){
  if(accountStatus!=="active")return;
  clearTimeout(socialRefreshTimer);
  socialRefreshTimer=setTimeout(async()=>{if(accountStatus==="active")await Promise.all([loadPeople(),loadMatches()]);},delay);
}
function scheduleActiveChatRefresh(delay=120){
  if(accountStatus!=="active"||!activeChat)return;
  clearTimeout(chatRefreshTimer);
  chatRefreshTimer=setTimeout(()=>{
    if(!activeChat)return;
    openChat(activeChat.matchId,activeChat.name,activeChat.userId,{silent:true,preserveDraft:true,noMatchRefresh:true});
  },delay);
}
function setTypingLabel(show){
  const el=$("chatPresence");
  if(!el)return;
  el.textContent=show?uiText("друкує…"):(el.dataset.idleLabel||chatConnectionLabel());
  el.classList.toggle("typing",show);
}
function getMatchChannel(matchId){return realtimeMatchChannels.get(String(matchId))?.channel||null}
function sendTyping(matchId,typing){
  if(accountStatus!=="active")return;
  const channel=getMatchChannel(matchId);if(!channel)return;
  const next=typing===true;
  channel.send({type:"broadcast",event:"typing",payload:{typing:next}}).catch?.(()=>{});
  if(localTypingActive!==next){
    localTypingActive=next;
    channel.track?.({
      user_id:String(profile?.user_id||""),
      typing:next,
      updated_at:new Date().toISOString(),
    }).catch?.(()=>{});
  }
}
function bindTyping(matchId){
  const field=$("chatMessage");if(!field)return;
  field.addEventListener("input",()=>{
    const now=Date.now();
    if(now-lastTypingSentAt>700){lastTypingSentAt=now;sendTyping(matchId,true)}
    clearTimeout(typingStopTimer);
    typingStopTimer=setTimeout(()=>sendTyping(matchId,false),1200);
  });
}
function setRealtimeBadge(live){
  realtimeConnected=live===true;
  const el=$("realtimeStatus");if(!el)return;
  el.textContent=realtimeConnected?"● realtime":"● автооновлення";
  el.classList.toggle("offline",!realtimeConnected);
}
function chatConnectionLabel(){return uiText("Приватний чат")}
function setupUserRealtime(topic){
  if(accountStatus!=="active"){teardownSocialRealtime();return}
  if(!realtimeClient||!topic){setRealtimeBadge(false);return}
  if(realtimeUserChannel&&realtimeUserChannelTopic===topic)return;
  if(realtimeUserChannel)realtimeClient.removeChannel(realtimeUserChannel);
  realtimeUserChannelTopic=topic;
  realtimeUserChannel=realtimeClient.channel("vybe:user:"+topic,{config:{broadcast:{self:false}}})
    .on("broadcast",{event:"match_created"},()=>{scheduleSocialRefresh(80);scheduleSupportCountRefresh()})
    .on("broadcast",{event:"chat_changed"},payload=>{
      const changedMatch=String(payload?.payload?.match_id||"");
      if(activeChat?.matchId===changedMatch&&String(payload?.payload?.sender_id||"")!==String(profile?.user_id)){
        scheduleActiveChatRefresh(50);
      }
      scheduleSocialRefresh(80);
      scheduleSupportCountRefresh();
    })
    .on("broadcast",{event:"call_changed"},()=>chatMedia?.poll())
    .on("broadcast",{event:"relationship_changed"},()=>{
      chatMedia?.disposeRecording();chatMedia?.endCall();
      if(activeChat){activeChat=null;sheet?.classList?.add("hidden");syncMatchRealtimeChannels()}
      scheduleSocialRefresh(80);
    })
    .subscribe(status=>setRealtimeBadge(status==="SUBSCRIBED"));
}
function syncMatchRealtimeChannels(){
  if(accountStatus!=="active"){teardownSocialRealtime();return}
  if(!realtimeClient)return;
  const wantedId=activeChat?.matchId||null;
  for(const [matchId,entry] of realtimeMatchChannels){
    if(matchId!==wantedId){
      localTypingActive=false;
      realtimeClient.removeChannel(entry.channel);
      realtimeMatchChannels.delete(matchId)
    }
  }
  if(!wantedId||realtimeMatchChannels.has(wantedId))return;
  const m=matches.find(x=>String(x.match_id)===wantedId);
  if(!m?.realtime_topic)return;
  const channel=realtimeClient.channel("vybe:match:"+m.realtime_topic,{config:{broadcast:{self:false}}})
    .on("presence",{event:"sync"},()=>{
      if(activeChat?.matchId!==wantedId)return;
      const state=channel.presenceState?.()||{};
      const peerTyping=Object.values(state).some(items=>Array.isArray(items)&&items.some(p=>
        String(p?.user_id||"")!==String(profile?.user_id||"")&&p?.typing===true
      ));
      setTypingLabel(peerTyping);
    })
    .on("broadcast",{event:"message_created"},payload=>{
      const senderId=String(payload?.payload?.sender_id||"");
      if(activeChat?.matchId===wantedId&&senderId!==String(profile?.user_id))scheduleActiveChatRefresh(50);
    })
    .on("broadcast",{event:"read_updated"},payload=>{
      const readerId=String(payload?.payload?.reader_id||"");
      if(activeChat?.matchId===wantedId&&readerId!==String(profile?.user_id))scheduleActiveChatRefresh(50);
    })
    .on("broadcast",{event:"typing"},payload=>{
      if(activeChat?.matchId!==wantedId)return;
      const isTyping=payload?.payload?.typing===true;
      clearTimeout(incomingTypingTimer);
      setTypingLabel(isTyping);
      if(isTyping)incomingTypingTimer=setTimeout(()=>setTypingLabel(false),2600);
    })
    .subscribe(status=>{
      if(status!=="SUBSCRIBED")return;
      channel.track?.({
        user_id:String(profile?.user_id||""),
        typing:localTypingActive,
        updated_at:new Date().toISOString(),
      }).catch?.(()=>{});
    });
  realtimeMatchChannels.set(wantedId,{channel,topic:m.realtime_topic});
}
const SOCIAL_RECONCILE_INTERVAL_MS=120000;
setInterval(()=>{
  if(document.visibilityState!=="visible"||accountStatus!=="active"||realtimeConnected)return;
  loadMatches();
  if(activeChat)scheduleActiveChatRefresh(0);
},SOCIAL_RECONCILE_INTERVAL_MS);
async function claimReferral(){
  const initParams=new URLSearchParams(tg?.initData||"");
  const pageParams=new URLSearchParams(location.search);
  const code=String(tg?.initDataUnsafe?.start_param||initParams.get("start_param")||pageParams.get("tgWebAppStartParam")||pageParams.get("ref")||"").trim().toLowerCase();
  if(!code)return;
  const r=await secureApi("referral_claim",{code});
  if(r.ok&&(r.claimed===true||r.reason==="already_claimed"))localStorage.setItem("vybeReferral:"+code,"1");
  else console.warn("VYBE referral claim failed",r);
}
async function openReferral(){
  const r=await secureApi("referral_stats");if(!r.ok){showAlert("Не вдалося завантажити реферальну статистику.");return}
  const link="https://t.me/vybe_now_bot?start="+encodeURIComponent("ref_"+r.code);
  const rewards=(r.rewards||[]).map(x=>'<div class="choice" style="margin-top:8px;opacity:'+(x.unlocked?'1':'.72')+'"><b>'+(x.unlocked?'✅ ':'🔒 ')+escapeHtml(x.milestone)+' активн.</b> — '+escapeHtml(x.label)+'<br><small>'+(x.unlocked?'Отримано':'Прогрес: '+escapeHtml(x.progress)+'/'+escapeHtml(x.milestone))+'</small></div>').join("");
  content.innerHTML='<h2>Запросити друзів 🔗</h2><p>Запрошено: <b>'+escapeHtml(r.invited)+'</b> • Активували анкету: <b>'+escapeHtml(r.activated)+'</b></p><h3 style="margin:14px 0 6px">Нагороди 🎁</h3>'+rewards+'<p style="margin-top:12px">Зараховуються лише друзі, які створили анкету 18+.</p><button id="shareReferral" class="primary">Поділитися запрошенням</button><button id="copyReferral" class="choice" style="width:100%;margin-top:10px">Скопіювати посилання</button>';
  sheet.classList.remove("hidden");
  $("shareReferral").onclick=()=>{const u="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent(uiText("Приєднуйся до VYBE 💜. Відкрий бота та натисни кнопку запуску VYBE."));analyticsCapture("referral_shared");tg?.openTelegramLink?.(u)};
  $("copyReferral").onclick=async()=>{try{await navigator.clipboard.writeText(link);showAlert("Посилання скопійовано ✅")}catch{showAlert(link)}};
}

const REPORT_REASONS=[
  ["fake_profile","Фейкова анкета / видає себе за іншу людину"],
  ["spam","Спам або шахрайство"],
  ["harassment","Образи, переслідування або шантаж"],
  ["underage","Можливо, користувачу немає 18 років"],
  ["sexual_services","Продаж або купівля сексуальних послуг"],
  ["illegal_content","Незаконний або небезпечний контент"],
  ["other","Інша причина"],
];

function confirmAction(message){
  const localized=uiText(message);
  return new Promise(resolve=>{
    if(tg?.showConfirm)tg.showConfirm(localized,ok=>resolve(ok===true));
    else resolve(window.confirm(localized));
  });
}

async function refreshSocial(){
  await Promise.all([loadPeople(),loadMatches()]);
  renderCard();renderMatches();renderChats();
}
async function openPublicProfile(userId,options={}){
  const r=await secureApi("profile_public",{target_user_id:userId});
  if(!r.ok||!r.profile){showAlert("Профіль недоступний.");return}
  const p=r.profile;
  const name=p.name||"VYBE";
  const photo=p.photo_url
    ? '<img class="publicProfilePhoto" src="'+escapeHtml(p.photo_url)+'" alt="'+escapeHtml(name)+'">'
    : '<div class="publicProfileFallback">'+escapeHtml((name||"V").trim().charAt(0).toUpperCase())+'</div>';
  const meta=[p.city,p.gender,p.looking_for?uiText("Шукаю: ")+p.looking_for:"",p.online?uiText("● онлайн"):""].filter(Boolean).join(" • ");
  const intent=isSupportedIntent(p.intent)?'<div class="intent">'+escapeHtml(intentIcon(p.intent))+' '+escapeHtml(p.intent)+'</div>':"";
  const matched=r.matched?'<div class="publicMatched">♡ '+uiText("У вас вже взаємний VYBE 💜")+'</div>':"";
  const chatButton=r.matched&&r.match_id?'<button id="publicChatBtn" class="primary">'+uiText("Написати повідомлення")+'</button>':"";
  const mapLikeButton=options.returnMap&&!r.matched?'<button id="publicMapLikeBtn" class="primary">'+uiText("Надіслати VYBE")+'</button>':"";
  const mapBackButton=options.returnMap?'<button id="publicBackMapBtn" class="choice">'+uiText("Назад до карти")+'</button>':"";
  const publicInterests='<div class="interestTags">'+interestTags(p.interests,normalizeInterests(p.interests).filter(x=>normalizeInterests(profile?.interests).includes(x)))+'</div>';
  const backButton=options.returnChat?'<button id="publicBackChatBtn" class="choice">'+uiText("Назад до чату")+'</button>':"";
  content.innerHTML='<div class="publicProfile">'+photo+'<div class="publicProfileBody"><h2>'+escapeHtml(name)+(p.age?", "+escapeHtml(p.age):"")+(p.verified?' ✓':'')+'</h2>'+matched+intent+publicInterests+'<p class="publicMeta">'+escapeHtml(meta)+'</p><p class="publicBio">'+escapeHtml(p.bio||"")+'</p>'+chatButton+mapLikeButton+mapBackButton+backButton+'<div class="publicProfileSafety"><button id="publicReportBtn" class="choice">⚑ '+uiText("Поскаржитися")+'</button><button id="publicBlockBtn" class="choice dangerChoice">🚫 '+uiText("Заблокувати")+'</button></div></div></div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  setSheetFullscreen(false);
  const mapBack=$("publicBackMapBtn");if(mapBack)mapBack.onclick=openPeopleMap;
  const like=$("publicMapLikeBtn");if(like)like.onclick=async()=>{like.disabled=true;const result=await secureApi("like",{target_user_id:userId,kind:"like"});if(!result.ok){like.disabled=false;showAlert("Не вдалося надіслати VYBE. Спробуй ще раз.");return}analyticsCapture("like_sent");await loadPeople();if(result.matched){await loadMatches();openMatchSuccess({id:userId})}else{like.textContent=uiText("VYBE надіслано")}};
  const report=$("publicReportBtn");if(report)report.onclick=()=>openReport(userId,name);
  const block=$("publicBlockBtn");if(block)block.onclick=()=>blockUser(userId,name);
  const chat=$("publicChatBtn");if(chat)chat.onclick=()=>openChat(r.match_id,name,userId);
  const back=$("publicBackChatBtn");if(back)back.onclick=()=>openChat(options.returnChat.matchId,options.returnChat.name,options.returnChat.userId);
}

function openUserSafety(userId,name){
  if(!userId)return;
  sendTyping(activeChat?.matchId,false);activeChat=null;syncMatchRealtimeChannels();
  const safeName=escapeHtml(name||(currentLang==="en"?"user":"користувача"));
  content.innerHTML='<h2>Безпека 🛡</h2><p>Дії щодо <b class="userNameNoI18n">'+safeName+'</b>.</p><button id="reportUserBtn" class="choice safetyChoice">⚑ Поскаржитися</button><button id="blockUserBtn" class="choice safetyChoice dangerChoice">🚫 Заблокувати</button><p class="safetyHint">Після блокування ви не бачитимете одне одного у VYBE, а чат і нові лайки стануть недоступними.</p>';
  sheet.classList.remove("hidden");
  $("reportUserBtn").onclick=()=>openReport(userId,name);
  $("blockUserBtn").onclick=()=>blockUser(userId,name);
}

async function blockUser(userId,name){
  const ok=await confirmAction("Заблокувати "+(name||(currentLang==="en"?"this user":"цього користувача"))+"? Ви більше не бачитимете одне одного у VYBE.");
  if(!ok)return;
  const r=await secureApi("block_user",{target_user_id:userId});
  if(!r.ok){showAlert("Не вдалося заблокувати користувача.");return}
  sheet.classList.add("hidden");
  await refreshSocial();
  analyticsCapture("user_blocked");
  tg?.HapticFeedback?.notificationOccurred("success");
  showAlert("Користувача заблоковано.");
}

function openReport(userId,name){
  let selectedReason=REPORT_REASONS[0][0];
  let blockRequested=true;
  const reasons=REPORT_REASONS.map(([value,label],i)=>'<button type="button" class="reportReasonBtn '+(i===0?"selected":"")+'" data-reason="'+escapeHtml(value)+'"><span>'+escapeHtml(label)+'</span><b>✓</b></button>').join("");
  content.innerHTML='<h2>Поскаржитися ⚑</h2><p>Скарга на <b class="userNameNoI18n">'+escapeHtml(name||(currentLang==="en"?"user":"користувача"))+'</b> буде передана на модерацію.</p><div class="reportReasonList">'+reasons+'</div><label>Деталі<textarea id="reportDetails" class="field" maxlength="1000" placeholder="Коротко опиши, що сталося. Не додавай зайві особисті дані."></textarea></label><button id="reportBlockToggle" type="button" class="reportBlockToggle selected" aria-pressed="true"><span><b>🚫 Також заблокувати цього користувача</b><small>Після скарги ви більше не бачитимете одне одного у VYBE.</small></span><strong>Увімкнено</strong></button><button id="submitReport" class="primary">Надіслати скаргу</button>';
  sheet.classList.remove("hidden");

  content.querySelectorAll(".reportReasonBtn").forEach(btn=>btn.onclick=()=>{
    selectedReason=btn.dataset.reason||REPORT_REASONS[0][0];
    content.querySelectorAll(".reportReasonBtn").forEach(x=>x.classList.toggle("selected",x===btn));
  });
  const blockToggle=$("reportBlockToggle");
  blockToggle.onclick=()=>{
    blockRequested=!blockRequested;
    blockToggle.classList.toggle("selected",blockRequested);
    blockToggle.setAttribute("aria-pressed",String(blockRequested));
    blockToggle.querySelector("strong").textContent=blockRequested?"Увімкнено":"Вимкнено";
  };

  $("submitReport").onclick=async()=>{
    const button=$("submitReport");
    button.disabled=true;
    const r=await secureApi("report_user",{
      target_user_id:userId,
      reason:selectedReason,
      details:$("reportDetails").value.trim(),
      block:blockRequested===true,
    });
    if(!r.ok){button.disabled=false;showAlert("Не вдалося надіслати скаргу.");return}
    sheet.classList.add("hidden");
    if(r.blocked)await refreshSocial();
    analyticsCapture("report_submitted",{blocked:r.blocked===true,reason:selectedReason});
    tg?.HapticFeedback?.notificationOccurred("success");
    showAlert(r.blocked?"Скаргу надіслано, користувача заблоковано.":"Скаргу надіслано.");
  };
}

async function openBlockedUsers(){
  content.innerHTML='<h2>Заблоковані користувачі 🚫</h2><div class="empty">Завантаження…</div>';
  sheet.classList.remove("hidden");
  const r=await secureApi("blocks_list");
  if(!r.ok){content.innerHTML='<h2>Заблоковані користувачі 🚫</h2><div class="empty">Не вдалося завантажити список.</div>';return}
  const rows=r.blocked||[];
  content.innerHTML='<h2>Заблоковані користувачі 🚫</h2>'+(rows.length?rows.map((x,i)=>{
    const n=x.profile?.name||"Користувач";
    const meta=[x.profile?.age,x.profile?.city].filter(Boolean).join(" • ");
    return '<div class="blockedRow"><div><b>'+escapeHtml(n)+'</b><small>'+escapeHtml(meta)+'</small></div><button class="choice unblockBtn" data-index="'+i+'">Розблокувати</button></div>';
  }).join(""):'<div class="empty">Тут поки нікого немає.</div>');
  content.querySelectorAll(".unblockBtn").forEach(btn=>btn.onclick=async()=>{
    const row=rows[Number(btn.dataset.index)];if(!row)return;
    btn.disabled=true;
    const x=await secureApi("unblock_user",{target_user_id:row.user_id});
    if(!x.ok){btn.disabled=false;showAlert("Не вдалося розблокувати.");return}
    await refreshSocial();
    await openBlockedUsers();
  });
}

let profile=load("vybeProfile",null),now=load("vybeNow",null),matches=[],index=0,filter="Усе",remotePeople=[],entitlements={balances:{supervybe:0,spotlight:0},vybe_plus_until:null,spotlight_until:null},starCatalog=[],adminRole=null,supportUnread=0,adminSupportUnread=0,moderationUnread=0,notificationUnread=0,accountStatus="active",restrictionReason=null,notificationPrefs={likes:true,matches:true,messages:true};
const DISCOVER_PAGE_SIZE=20;
let discoverCursor=null,discoverSnapshot=null,discoverHasMore=false,discoverLoading=false,discoverGeneration=0;
let discoverFilters=load("vybeDiscoverFilters",{minAge:18,maxAge:99,city:"",onlineOnly:false,verifiedOnly:false});
localStorage.removeItem("vybeMatches");
async function loadEntitlements(){const r=await secureApi("entitlements");if(r.ok)entitlements=r;return r}
async function loadNotificationSettings(){
  const r=await secureApi("notification_settings_get");
  if(r.ok&&r.preferences){
    notificationPrefs={
      likes:r.preferences.likes!==false,
      matches:r.preferences.matches!==false,
      messages:r.preferences.messages!==false,
    };
  }
  return r;
}
async function toggleNotificationPreference(key){
  if(!["likes","matches","messages"].includes(key))return;
  const next=!notificationPrefs[key];
  const r=await secureApi("notification_settings_update",{[key]:next});
  if(!r.ok){showAlert("Не вдалося оновити сповіщення.");return}
  notificationPrefs={
    likes:r.preferences?.likes!==false,
    matches:r.preferences?.matches!==false,
    messages:r.preferences?.messages!==false,
  };
  analyticsCapture("notification_setting_changed",{setting:key,enabled:notificationPrefs[key]===true});
  tg?.HapticFeedback?.selectionChanged?.();
  openSettings();
}
function notificationToggleMarkup(id,label,key,icon){
  const enabled=notificationPrefs[key]===true;
  return '<button id="'+id+'" class="choice safetyChoice notificationToggle '+(enabled?"selected":"")+'"><span>'+icon+' '+uiText(label)+'</span><b>'+uiText(enabled?"Увімкнено":"Вимкнено")+'</b></button>';
}

function renderNotificationBadge(){
  const badge=$("notificationBadge");
  if(!badge)return;
  badge.textContent=notificationUnread>99?"99+":String(notificationUnread||0);
  badge.classList.toggle("hidden",!notificationUnread);
}
function notificationCenterTime(iso){
  if(!iso)return "";
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";
  const now=new Date();
  if(d.toDateString()===now.toDateString())return d.toLocaleTimeString(uiLocale(),{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString(uiLocale(),{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString(uiLocale(),{hour:"2-digit",minute:"2-digit"});
}
function notificationPresentation(n){
  const payload=n.payload||{};
  if(n.event_type==="like"){
    const superV=payload.variant==="super";
    return {
      icon:superV?"✦":"💜",
      title:uiText(superV?"Новий SuperVYBE":"Новий лайк"),
      subtitle:uiText(superV?"Хтось надіслав тобі SuperVYBE.":"Хтось вподобав твою анкету."),
      action:"likes",
    };
  }
  if(n.event_type==="match"){
    return {icon:"✨",title:uiText("Взаємний VYBE 💜"),subtitle:n.actor?.name||"VYBE",action:"chat"};
  }
  if(n.event_type==="message"){
    return {icon:"💬",title:uiText("Нове повідомлення"),subtitle:n.actor?.name||uiText("У тебе нове повідомлення."),action:"chat"};
  }
  const kind=payload.kind||"system";
  if(kind==="support_reply")return {icon:"⚑",title:uiText("Відповідь підтримки"),subtitle:uiText("Підтримка відповіла на твоє звернення."),action:"support"};
  if(kind==="account_restricted")return {icon:"🛡",title:uiText("Система"),subtitle:uiText("Доступ до акаунта обмежено."),action:"restriction"};
  if(kind==="account_restored")return {icon:"✅",title:uiText("Система"),subtitle:uiText("Доступ до VYBE відновлено."),action:null};
  return {icon:"🔔",title:uiText("Система"),subtitle:"VYBE",action:null};
}
function openLikeNotificationUpsell(){
  content.innerHTML='<div class="likeNotice"><div class="likeNoticeIcon">💜</div><h2>'+uiText("Тобі поставили VYBE 💜")+'</h2><p>'+uiText("Хтось уже зацікавився твоєю анкетою.")+'</p><div class="likeNoticePlus"><b>VYBE+</b><span>'+uiText("VYBE+ покаже, хто саме це.")+'</span></div><button id="likeNoticePlusBtn" class="primary">'+uiText("Подивитися хто — VYBE+")+'</button><button id="likeNoticeBrowseBtn" class="choice">'+uiText("Продовжити пошук")+'</button></div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const plusBtn=$("likeNoticePlusBtn");if(plusBtn)plusBtn.onclick=()=>openSheet("premium");
  const browseBtn=$("likeNoticeBrowseBtn");if(browseBtn)browseBtn.onclick=()=>{
    sheet.classList.add("hidden");tg?.BackButton?.hide?.();
    const discoverNav=document.querySelector('.navItem[data-target="discoverView"]');
    if(discoverNav)discoverNav.click();
  };
}
async function openNotificationTarget(n){
  const p=notificationPresentation(n);
  if((p.action==="chat"||p.action==="likes")&&n.match_id){
    await loadMatches();
    const target=matches.find(x=>String(x.match_id)===String(n.match_id));
    if(target){await openChat(target.match_id,target.name,target.id);return}
  }
  if(p.action==="chat"){
    showAlert("Чат недоступний.");return;
  }
  if(p.action==="likes"){
    if(plusActive())await openWhoLikedMe();
    else openLikeNotificationUpsell();
    return;
  }
  if(p.action==="support"){await openSupportInfo();return}
  if(p.action==="restriction"){openRestrictionNotice();return}
}
async function openNotificationCenter(initialFilter="all"){
  setSheetFullscreen(true);
  content.innerHTML='<h2>'+uiText("Сповіщення 🔔")+'</h2><div class="empty">'+uiText("Завантаження…")+'</div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const r=await secureApi("notifications_list");
  if(!r.ok){
    content.innerHTML='<h2>'+uiText("Сповіщення 🔔")+'</h2><div class="empty">'+escapeHtml(r.error||"Error")+'</div>';
    return;
  }
  const rows=r.notifications||[];
  let activeFilter=initialFilter;
  const render=()=>{
    const filtered=activeFilter==="all"?rows:rows.filter(x=>x.event_type===activeFilter);
    const filters=[
      ["all","Усі"],["like","Лайки"],["match","Збіги"],["message","Повідомлення"],["system","Система"]
    ].map(([key,label])=>'<button class="notificationFilter '+(activeFilter===key?"selected":"")+'" data-filter="'+key+'">'+uiText(label)+'</button>').join("");
    const list=filtered.length?filtered.map((n,i)=>{
      const p=notificationPresentation(n);
      const actor=n.actor&&n.event_type!=="like"?'<span class="notificationActor userNameNoI18n">'+escapeHtml(p.subtitle)+'</span>':'<span>'+escapeHtml(p.subtitle)+'</span>';
      const media=n.actor?.photo_url&&n.event_type!=="like"
        ? avatarMarkup(n.actor.photo_url,n.actor.name,'notificationAvatar')
        : '<span class="notificationEmoji">'+p.icon+'</span>';
      return '<button class="notificationItem '+(n.unread?"unread":"")+'" data-index="'+i+'">'+media+'<span class="notificationText"><b>'+escapeHtml(p.title)+'</b>'+actor+'<small>'+escapeHtml(notificationCenterTime(n.created_at))+'</small></span><span class="notificationChevron">'+(p.action?"›":"")+'</span></button>';
    }).join(""):'<div class="empty">'+uiText("Нових сповіщень немає.")+'</div>';
    content.innerHTML='<div class="notificationHead"><h2>'+uiText("Сповіщення 🔔")+'</h2><span class="notificationCount">'+rows.length+'</span></div><div class="notificationFilters">'+filters+'</div><div class="notificationList">'+list+'</div>';
    bindAvatarFallbacks(content);
    content.querySelectorAll(".notificationFilter").forEach(btn=>btn.onclick=()=>{activeFilter=btn.dataset.filter||"all";render()});
    content.querySelectorAll(".notificationItem").forEach(btn=>btn.onclick=()=>{const n=filtered[Number(btn.dataset.index)];if(n)openNotificationTarget(n)});
  };
  render();
  analyticsCapture("notification_center_opened",{count:rows.length,unread:Number(r.unread||0)});
  if(Number(r.unread||0)>0){
    const seen=await secureApi("notifications_mark_seen");
    if(seen.ok){notificationUnread=0;renderNotificationBadge()}
  }
}

function setMenuBadge(buttonId,count){
  const btn=$(buttonId);if(!btn)return;
  let badge=btn.querySelector(".menuBadge");
  if(!badge){badge=document.createElement("b");badge.className="menuBadge";btn.appendChild(badge)}
  badge.textContent=Number(count)>99?"99+":String(Number(count)||0);
  badge.classList.toggle("hidden",!Number(count));
}
function renderSupportBadges(){
  setMenuBadge("supportBtn",supportUnread);
  setMenuBadge("adminSupportBtn",adminSupportUnread);
}
async function loadSupportCounts(){
  const previousStatus=accountStatus;
  const r=await secureApi("support_counts");
  if(r.ok){
    supportUnread=Number(r.user_unread||0);
    adminSupportUnread=Number(r.admin_unread||0);
    moderationUnread=Number(r.moderation_unread||0);
    notificationUnread=Number(r.notification_unread||0);
    renderNotificationBadge();
    if(r.admin_role&&!adminRole)adminRole=r.admin_role;
    const nextStatus=r.account_status||accountStatus||"active";
    restrictionReason=r.restriction_reason||null;
    if(nextStatus==="restricted"){
      enterRestrictedMode(restrictionReason,{showNotice:previousStatus!=="restricted"});
    }else if(previousStatus==="restricted"&&nextStatus==="active"){
      accountStatus="active";
      restrictionReason=null;
      location.reload();
      return r;
    }else{
      accountStatus=nextStatus;
    }
    renderSupportBadges();
    const adminBtn=$("adminFinanceBtn");if(adminBtn)adminBtn.classList.toggle("hidden",!adminRole);
    const adminSupport=$("adminSupportBtn");if(adminSupport)adminSupport.classList.toggle("hidden",!adminRole);
    const adminModeration=$("adminModerationBtn");if(adminModeration)adminModeration.classList.toggle("hidden",!adminRole);
    setMenuBadge("adminModerationBtn",moderationUnread);
  }
  return r;
}

function spotlightStatus(){const until=entitlements?.spotlight_until?new Date(entitlements.spotlight_until):null;if(!until||until<=new Date())return uiText("не активний");const min=Math.max(1,Math.ceil((until-Date.now())/60000));return uiText("🔦 активний ще ")+min+uiText(" хв.")}
function entitlementText(){const plus=entitlements?.vybe_plus_until&&new Date(entitlements.vybe_plus_until)>new Date()?new Date(entitlements.vybe_plus_until).toLocaleDateString(uiLocale()):"—";return "SuperVYBE: "+(entitlements?.balances?.supervybe||0)+" • Spotlight: "+(entitlements?.balances?.spotlight||0)+" • "+spotlightStatus()+uiText(" • VYBE+ до: ")+plus}
async function useSpotlight(){const r=await secureApi("spotlight_use");if(!r.ok){showAlert("Spotlight не списано. Перевір баланс і спробуй ще раз.");return}await loadEntitlements();analyticsCapture("spotlight_used");tg?.HapticFeedback?.notificationOccurred("success");showAlert("Spotlight активовано на 30 хвилин ✨");openSheet("premium")}

async function loadStarCatalog(){
  const r=await secureApi("star_catalog");
  if(r.ok)starCatalog=r.products||[];
  return r;
}
function starProductTitle(p){return currentLang==="en"?p.title_en:p.title_uk}
function starProductDescription(p){return currentLang==="en"?p.description_en:p.description_uk}
function plusActive(){return !!entitlements?.vybe_plus_until&&new Date(entitlements.vybe_plus_until)>new Date()}
async function waitForStarOrder(orderId){
  for(let i=0;i<12;i++){
    const r=await secureApi("star_order_status",{order_id:orderId});
    if(r.ok&&["paid","failed","expired","refunded"].includes(r.order?.status))return r.order;
    await new Promise(resolve=>setTimeout(resolve,650+i*110));
  }
  return null;
}
function showAppNotice(message){
  let box=document.getElementById("appNotice");
  if(!box){
    box=document.createElement("div");
    box.id="appNotice";
    box.className="appNotice hidden";
    box.innerHTML='<span id="appNoticeText"></span><button id="appNoticeClose" type="button">×</button>';
    document.body.appendChild(box);
    box.querySelector("#appNoticeClose").onclick=()=>box.classList.add("hidden");
  }
  box.querySelector("#appNoticeText").textContent=uiText(message);
  box.classList.remove("hidden");
  clearTimeout(showAppNotice.timer);
  showAppNotice.timer=setTimeout(()=>box.classList.add("hidden"),6000);
}
async function recoverTestRefund(){
  const r=await secureApi("star_test_refund");
  if(r.ok&&r.refunded){
    await loadEntitlements();
    showAppNotice("Тест успішний ✅ 1 Star повернуто.");
    return true;
  }
  return false;
}
async function buyStarProduct(productKey,button){
  if(!tg?.openInvoice){showAlert("Платежі доступні лише всередині Telegram.");return}
  const terms=$("acceptPurchaseTerms");
  if(!terms?.checked){showAlert("Перед оплатою прийми Умови користування.");return}
  const originalLabel=button?.textContent||"";
  if(button){button.disabled=true;button.textContent=uiText("Перевіряємо покупку…")}
  const r=await secureApi("star_invoice",{product_key:productKey,lang:currentLang,terms_accepted:true});
  if(!r.ok||!r.invoice_url){
    if(button){button.disabled=false;button.textContent=originalLabel}
    showAlert("Не вдалося створити рахунок.");
    return;
  }
  if(button)button.textContent=uiText("Очікуємо Telegram…");
  analyticsCapture("stars_checkout_started",{product_key:productKey,stars:Number(r.stars||0)});
  tg.openInvoice(r.invoice_url,async status=>{
    const finalStatus=String(status||"unknown");
    analyticsCapture("stars_checkout_closed",{product_key:productKey,status:finalStatus});
    if(finalStatus==="paid"||finalStatus==="pending"){
      let order=await waitForStarOrder(r.order_id);
      if(productKey==="test_1_star"&&order?.status==="paid"){
        const refund=await secureApi("star_test_refund");
        if(refund.ok&&refund.refunded){
          order={...order,status:"refunded"};
          analyticsCapture("stars_test_refunded",{stars:1});
        }
      }
      await loadEntitlements();
      if(order?.status==="paid"){
        analyticsCapture("stars_purchase_confirmed",{product_key:productKey,stars:Number(r.stars||0)});
        tg?.HapticFeedback?.notificationOccurred("success");
        closeSheetView();
        showAppNotice("Покупка успішна ⭐");
      }else if(order?.status==="refunded"&&productKey==="test_1_star"){
        tg?.HapticFeedback?.notificationOccurred("success");
        closeSheetView();
        showAppNotice("Тест успішний ✅ 1 Star повернуто.");
      }else{
        showAlert("Платіж обробляється. Баланс оновиться автоматично.");
        await renderPremiumShop(false);
      }
      return;
    }
    if(finalStatus==="cancelled"){
      await secureApi("star_order_close",{order_id:r.order_id,status:"cancelled"});
      showAlert("Оплату скасовано.");
    }else if(finalStatus==="failed"){
      await secureApi("star_order_close",{order_id:r.order_id,status:"failed"});
      showAlert("Оплата не пройшла.");
    }
    if(button){button.disabled=false;button.textContent=originalLabel}
  });
}
async function openWhoLikedMe(){
  setSheetFullscreen(true);
  content.innerHTML='<h2>'+uiText("Хто лайкнув мене")+'</h2><div class="empty">'+uiText("Завантаження…")+'</div>';
  sheet.classList.remove("hidden");
  const r=await secureApi("likes_received");
  if(!r.ok){
    content.innerHTML='<h2>'+uiText("Хто лайкнув мене")+'</h2><div class="empty">'+uiText("Потрібен активний VYBE+.")+'</div>';
    return;
  }
  const rows=r.people||[];
  content.innerHTML='<h2>'+uiText("Хто лайкнув мене")+'</h2><p class="safetyHint">'+uiText("VYBE+ відкриває список людей, які вже лайкнули тебе.")+'</p>'+(rows.length?rows.map((x,i)=>{
    const p=x.profile||{};
    return '<div class="blockedRow"><div>'+(p.photo_url?'<img class="avatar avatarPhoto" src="'+escapeHtml(p.photo_url)+'" alt="">':'')+'<b class="userNameNoI18n">'+escapeHtml(p.name||"VYBE")+(p.age?", "+escapeHtml(p.age):"")+(p.verified?' ✓':'')+'</b><small>'+[p.city,p.online?uiText("● онлайн"):"",x.like_kind==="super"?"✦ SuperVYBE":""].filter(Boolean).map(escapeHtml).join(" • ")+'</small></div><button class="choice likeBackBtn" data-index="'+i+'">'+uiText("Лайкнути у відповідь")+'</button></div>';
  }).join(""):'<div class="empty">'+uiText("Поки немає нових лайків.")+'</div>');
  content.querySelectorAll(".likeBackBtn").forEach(btn=>btn.onclick=async()=>{
    const row=rows[Number(btn.dataset.index)];if(!row)return;
    btn.disabled=true;
    const x=await secureApi("like",{target_user_id:row.user_id,kind:"like"});
    if(!x.ok){btn.disabled=false;showAlert("Не вдалося надіслати VYBE. Спробуй ще раз.");return}
    analyticsCapture("like_back_from_vybe_plus");
    if(x.matched){await loadMatches();showAlert("У вас взаємний VYBE 💜")}
    await openWhoLikedMe();
  });
}
async function renderPremiumShop(resetScroll=true){
  await Promise.all([loadEntitlements(),loadStarCatalog()]);
  const b=entitlements?.balances||{};
  const plus=plusActive()?new Date(entitlements.vybe_plus_until).toLocaleDateString(uiLocale()):uiText("не активний");
  const products=starCatalog.map(p=>'<div class="starProduct"><div><b>'+escapeHtml(starProductTitle(p))+'</b><small>'+escapeHtml(starProductDescription(p))+'</small></div><button class="choice buyStarBtn" data-product="'+escapeHtml(p.product_key)+'">'+uiText("Купити за ")+'⭐ '+Number(p.stars||0)+'</button></div>').join("");
  content.innerHTML='<h2>'+uiText("Мої бонуси ✨")+'</h2><p>'+entitlementText()+'</p><div class="priceGrid"><div class="price"><span>SuperVYBE</span><strong>'+Number(b.supervybe||0)+'</strong></div><div class="price"><span>Spotlight</span><strong>'+Number(b.spotlight||0)+'</strong></div><div class="price"><span>VYBE+</span><strong>'+escapeHtml(plus)+'</strong></div></div>'+(Number(b.spotlight||0)>0?'<button id="useSpotlight" class="primary">'+uiText("Активувати Spotlight на 30 хв")+'</button>':'')+(plusActive()?'<button id="whoLikedBtn" class="choice premiumFeatureBtn">♥ '+uiText("Хто лайкнув мене")+'</button>':'')+'<h3 class="shopTitle">'+uiText("Магазин Stars ⭐")+'</h3><p class="safetyHint">'+uiText("Оплата відкриється у Telegram.")+'</p><label class="checkRow purchaseTerms"><input id="acceptPurchaseTerms" type="checkbox"><span>'+uiText("Я приймаю Умови користування для покупки цифрових товарів.")+' <button id="shopTermsBtn" type="button" class="inlineLink">'+uiText("Умови")+'</button></span></label><div class="starShop">'+(products||'<div class="empty">'+uiText("Завантажуємо магазин…")+'</div>')+'</div><div class="shopFooter"><button id="returnToVybeBtn" class="primary">'+uiText("Повернутися у VYBE")+'</button></div>';
  const u=$("useSpotlight");if(u)u.onclick=useSpotlight;
  const liked=$("whoLikedBtn");if(liked)liked.onclick=openWhoLikedMe;
  const shopTerms=$("shopTermsBtn");if(shopTerms)shopTerms.onclick=()=>openLegalPage("terms.html");
  const returnBtn=$("returnToVybeBtn");if(returnBtn)returnBtn.onclick=closeSheetView;
  const terms=$("acceptPurchaseTerms");
  const buyButtons=[...content.querySelectorAll(".buyStarBtn")];
  buyButtons.forEach(btn=>{btn.disabled=true;btn.onclick=()=>buyStarProduct(btn.dataset.product,btn)});
  if(terms)terms.onchange=()=>buyButtons.forEach(btn=>btn.disabled=!terms.checked);
  if(resetScroll)requestAnimationFrame(()=>{const card=sheet.querySelector(".sheetCard");if(card)card.scrollTop=0});
}


const INTENT_ICONS=Object.freeze({"Поговорити":"💬","Флірт":"🔥","Дружба":"🫶","Голос":"🎙","Зустріч":"☕"});
const isSupportedIntent=x=>Object.prototype.hasOwnProperty.call(INTENT_ICONS,x);
const intentIcon=x=>INTENT_ICONS[x]||"⚡";
$("hello").textContent=uiText("Привіт, ")+(tuser?.first_name||profile?.name||"");

async function syncProfile(){
  if(!profile)return false;
  const r=await secureApi("save_profile",{profile});
  if(!r.ok)return false;
  profile={...profile,user_id:r.user_id};store("vybeProfile",profile);return true;
}
async function syncNow(hours=1){
  if(!now)return false;
  const r=await secureApi("set_intent",{intent:now.intent,hours});
  if(!r.ok)return false;
  if(r.expires_at){now.expires=new Date(r.expires_at).getTime();store("vybeNow",now);renderNow()}
  return true;
}
function discoveryRequestPayload(extra={}){
  return {
    min_age:Number(discoverFilters.minAge)||18,
    max_age:Number(discoverFilters.maxAge)||99,
    city:String(discoverFilters.city||""),
    online_only:discoverFilters.onlineOnly===true,
    verified_only:discoverFilters.verifiedOnly===true,
    intent:filter==="Усе"?"":filter,
    interests:normalizeInterests(discoverFilters.interests),
    common_only:discoverFilters.commonOnly===true,
    page_size:DISCOVER_PAGE_SIZE,
    ...extra,
  };
}
function mapDiscoveryPeople(rows){
  return (rows||[]).filter(p=>isSupportedIntent(p.intent)).map(p=>({
    id:p.user_id,
    name:p.name||"VYBE",
    age:p.age||18,
    intent:p.intent||"Поговорити",
    icon:intentIcon(p.intent),
    interests:normalizeInterests(p.interests),
    common_interests:normalizeInterests(p.common_interests),
    bio:p.bio||"Новий користувач VYBE",
    city:p.city||"",
    meta:[p.city||"VYBE",p.online?uiText("● онлайн"):uiText("нещодавно"),p.verified?uiText("✓ верифіковано"):""].filter(Boolean).join(" • "),
    img:p.photo_url||null,
    verified:p.verified===true,
    online:p.online===true,
    expires_at:p.expires_at||null,
    spotlight_active:p.spotlight_active===true,
    already_matched:p.already_matched===true,
  }));
}
function applyDiscoveryPagination(r){
  const pg=r?.pagination||{};
  discoverCursor=pg.next_cursor||null;
  discoverSnapshot=pg.snapshot_at||null;
  discoverHasMore=pg.has_more===true&&!!discoverCursor;
}
async function loadPeople(){
  const generation=++discoverGeneration;
  discoverLoading=true;
  discoverHasMore=false;
  discoverCursor=null;
  discoverSnapshot=null;
  try{
    const r=await secureApi("discover",discoveryRequestPayload());
    if(generation!==discoverGeneration)return false;
    if(!r.ok)return false;
    remotePeople=mapDiscoveryPeople(r.people);
    applyDiscoveryPagination(r);
    index=0;
    return true;
  }finally{
    if(generation===discoverGeneration){
      discoverLoading=false;
      renderCard();
    }
  }
}
async function loadMorePeople(){
  if(discoverLoading||!discoverHasMore||!discoverCursor||!discoverSnapshot)return false;
  const generation=discoverGeneration;
  discoverLoading=true;
  try{
    const r=await secureApi("discover",discoveryRequestPayload({
      cursor:discoverCursor,
      snapshot_at:discoverSnapshot,
    }));
    if(generation!==discoverGeneration)return false;
    if(!r.ok)return false;
    const incoming=mapDiscoveryPeople(r.people);
    if(r.pagination?.reset===true){
      remotePeople=incoming;
      index=0;
    }else{
      const seen=new Set(remotePeople.map(p=>String(p.id)));
      for(const p of incoming){
        if(!seen.has(String(p.id))){
          seen.add(String(p.id));
          remotePeople.push(p);
        }
      }
    }
    applyDiscoveryPagination(r);
    return true;
  }finally{
    if(generation===discoverGeneration){
      discoverLoading=false;
      renderCard();
    }
  }
}
async function hydrateProfile(){
  const r=await secureApi("profile_get");if(!r.ok)return;
  analyticsDistinctId=r.user_id||null;
  adminRole=r.admin_role||null;
  accountStatus=r.account_status||"active";
  restrictionReason=r.restriction_reason||null;
  if(r.realtime_topic){realtimeUserTopic=r.realtime_topic;setupUserRealtime(realtimeUserTopic)}
  if(accountStatus==="active")chatMedia?.start();else chatMedia?.stop();
  if(r.profile){profile={name:r.profile.name,age:r.profile.age,city:r.profile.city||"",gender:r.profile.gender||"",looking:r.profile.looking_for||"",bio:r.profile.bio||"",photo_url:r.profile.photo_url||null,verified:r.profile.verified===true,user_id:r.user_id,interests:normalizeInterests(r.profile.interests),map_enabled:r.profile.map_enabled===true,map_lat:r.profile.map_lat??null,map_lng:r.profile.map_lng??null};store("vybeProfile",profile)}
}
async function begin(){
  if(validNow()){
    filter=String(now.intent||"Усе");
    document.querySelectorAll(".mood").forEach(x=>x.classList.toggle("active",x.dataset.mood===filter));
  }
  const auth=await verifyTelegramAuth();window.__vybeAuth=auth;
  if(!auth?.ok){console.warn("VYBE secure auth not confirmed",auth);showAlert("Не вдалося підтвердити Telegram-авторизацію. Відкрий VYBE заново через бота.");return}
  await claimReferral();
  await hydrateProfile();
  await recoverTestRefund();
  analyticsCapture("app_open");
  const launchParams=new URL(location.href).searchParams;
  const launchTicket=launchParams.get("ticket");
  const launchReport=launchParams.get("report");
  const launchChat=launchParams.get("chat");

  if(accountStatus==="restricted"){
    if(profile)renderProfile();
    remotePeople=[];matches=[];await loadSupportCounts();renderNow();renderCard();renderMatches();renderChats();
    if(launchParams.get("support")==="ticket")await openSupportInfo();
    else openRestrictionNotice();
    history.replaceState({},document.title,location.pathname);
    return;
  }

  if(!profile)showOnboarding();else{renderProfile();await syncProfile();await loadPeople()}
  await loadEntitlements();await loadNotificationSettings();await loadMatches();await loadSupportCounts();renderNow();renderCard();renderMatches();renderChats();
  if(adminRole&&launchParams.get("admin")==="support"){
    await openAdminSupport(launchTicket);
    history.replaceState({},document.title,location.pathname);
  }else if(adminRole&&launchParams.get("admin")==="moderation"){
    await openAdminModeration(launchReport);
    history.replaceState({},document.title,location.pathname);
  }else if(launchParams.get("support")==="ticket"){
    await openSupportInfo();
    history.replaceState({},document.title,location.pathname);
  }else if(launchChat){
    const chatTarget=matches.find(x=>String(x.match_id)===String(launchChat));
    if(chatTarget)await openChat(chatTarget.match_id,chatTarget.name,chatTarget.id);
    history.replaceState({},document.title,location.pathname);
  }
}
const age=$("ageConfirm"),enterBtn=$("enterBtn");
function syncAgeButton(){enterBtn.disabled=!age.checked}
age.addEventListener("change",syncAgeButton);
age.addEventListener("input",syncAgeButton);
enterBtn.addEventListener("click",async()=>{
  if(!age.checked)return;
  enterBtn.disabled=true;enterBtn.textContent="Входимо…";
  localStorage.setItem("vybe18","yes");$("ageGate").classList.add("hidden");
  try{await begin()}finally{enterBtn.textContent="Увійти";syncAgeButton()}
});
syncAgeButton();
if(localStorage.getItem("vybe18")==="yes"){$("ageGate").classList.add("hidden");setTimeout(begin,0)}
let supportRefreshTimer=null;
function scheduleSupportCountRefresh(){
  clearTimeout(supportRefreshTimer);
  supportRefreshTimer=setTimeout(()=>{if(document.visibilityState==="visible"&&window.__vybeAuth?.ok)loadSupportCounts()},250);
}
window.addEventListener("focus",scheduleSupportCountRefresh);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){scheduleSupportCountRefresh();if(window.__vybeAuth?.ok&&accountStatus==="active"){hydrateProfile().then(()=>renderProfile()).catch(()=>{});loadMatches();loadPeople()}}});

let readOnboardingInterests=()=>[],onboardingMapPoint=null,mapController=null,mapViewState=null,mapMountToken=0;
function showOnboarding(){
  const o=$("onboarding");o.classList.remove("hidden");
  $("obName").value=profile?.name||tuser?.first_name||"";$("obAge").value=profile?.age||"";$("obCity").value=profile?.city||"";$("obGender").value=profile?.gender||"";$("obLooking").value=profile?.looking||"";$("obBio").value=profile?.bio||"";
  $("obInterests").innerHTML=interestPickerMarkup("obInterestChoices",profile?.interests);
  readOnboardingInterests=bindInterestPicker("obInterestChoices",profile?.interests);
  onboardingMapPoint=profile?.map_enabled?snapMapPoint(Number(profile.map_lat),Number(profile.map_lng)):null;
  $("obMapEnabled").checked=profile?.map_enabled===true;updateOnboardingMapStatus();
}
function updateOnboardingMapStatus(){$("obMapStatus").textContent=uiText(onboardingMapPoint?"Район обрано. Позначка приблизна.":"Район ще не обрано.")}
$("obMapEnabled").onchange=()=>{if($("obMapEnabled").checked&&!onboardingMapPoint)pickProfileMapArea();if(!$("obMapEnabled").checked)onboardingMapPoint=null;updateOnboardingMapStatus()};
$("obPickArea").onclick=pickProfileMapArea;
$("saveProfile").onclick=async()=>{
  const age=+$("obAge").value;
  if(!$("obName").value.trim()||age<18||age>99){showAlert("Вкажи ім’я та вік 18+.");return}
  const mapEnabled=$("obMapEnabled").checked;
  if(mapEnabled&&!onboardingMapPoint){showAlert("Обери район на карті або вимкни показ на карті.");return}
  const candidate={...profile,name:$("obName").value.trim(),age,city:$("obCity").value.trim(),gender:$("obGender").value.trim(),looking:$("obLooking").value.trim(),bio:$("obBio").value.trim(),interests:readOnboardingInterests(),map_enabled:mapEnabled,map_lat:mapEnabled?onboardingMapPoint.lat:null,map_lng:mapEnabled?onboardingMapPoint.lng:null};
  const button=$("saveProfile");button.disabled=true;
  try{
    const r=await secureApi("save_profile",{profile:candidate});
    if(!r.ok){showAlert("Не вдалося зберегти анкету. Спробуй ще раз.");return}
    profile={...candidate,user_id:r.user_id};store("vybeProfile",profile);
    $("onboarding").classList.add("hidden");renderProfile();analyticsCapture("profile_saved",{interests_count:profile.interests.length});
    await loadPeople();tg?.HapticFeedback?.notificationOccurred("success");
  }finally{button.disabled=false}
};
$("editProfile").onclick=showOnboarding;
function renderProfile(){
  if(!profile)return;
  $("profileName").textContent=profile.name+", "+profile.age+(profile.verified?" ✓":"");
  $("profileMeta").textContent=[profile.city,profile.gender,profile.looking&&uiText("Шукаю: ")+profile.looking].filter(Boolean).join(" • ");
  $("profileBio").textContent=profile.bio||"Без опису";
  $("profileInterests").innerHTML=interestTags(profile.interests);
  const avatar=$("profileAvatar");
  if(avatar){
    if(profile.photo_url){
      avatar.textContent="";
      avatar.style.backgroundImage='url("'+String(profile.photo_url).replace(/"/g,"%22")+'")';
      avatar.classList.add("hasPhoto");
    }else{
      avatar.style.backgroundImage="";
      avatar.textContent=(profile.name||"V").trim().charAt(0).toUpperCase()||"V";
      avatar.classList.remove("hasPhoto");
    }
  }
  const remove=$("removePhotoBtn");if(remove)remove.classList.toggle("hidden",!profile.photo_url);
  const adminBtn=$("adminFinanceBtn");if(adminBtn)adminBtn.classList.toggle("hidden",!adminRole);
  const adminSupport=$("adminSupportBtn");if(adminSupport)adminSupport.classList.toggle("hidden",!adminRole);
  const adminModeration=$("adminModerationBtn");if(adminModeration)adminModeration.classList.toggle("hidden",!adminRole);
  renderSupportBadges();
  setMenuBadge("adminModerationBtn",moderationUnread);
}

function readImageAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("read_failed"));
    reader.onload=()=>resolve(String(reader.result||""));
    reader.readAsDataURL(file);
  });
}
async function prepareProfilePhoto(file){
  if(!file||!String(file.type||"").startsWith("image/"))throw new Error("not_image");
  if(file.size>12*1024*1024)throw new Error("too_large_source");
  const src=await readImageAsDataUrl(file);
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=src});
  const side=Math.min(img.naturalWidth,img.naturalHeight);
  const sx=Math.max(0,(img.naturalWidth-side)/2),sy=Math.max(0,(img.naturalHeight-side)/2);
  const canvas=document.createElement("canvas");canvas.width=900;canvas.height=900;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("canvas_failed");
  ctx.drawImage(img,sx,sy,side,side,0,0,900,900);
  let out=canvas.toDataURL("image/webp",.82);
  if(!out.startsWith("data:image/webp"))out=canvas.toDataURL("image/jpeg",.82);
  let [header,data]=out.split(",");
  if(!data)throw new Error("encode_failed");
  let mime=header.match(/^data:([^;]+)/)?.[1]||"image/jpeg";
  if(data.length>2500000){
    out=canvas.toDataURL(mime,.68);[header,data]=out.split(",");mime=header.match(/^data:([^;]+)/)?.[1]||mime;
  }
  if(!data||data.length>2800000)throw new Error("too_large_encoded");
  return {mime,image_base64:data};
}
async function uploadProfilePhoto(file){
  const btn=$("photoBtn");if(btn){btn.disabled=true;btn.textContent="Обробляємо фото…"}
  try{
    const prepared=await prepareProfilePhoto(file);
    if(btn)btn.textContent="Завантажуємо…";
    const r=await secureApi("photo_upload",{mime_type:prepared.mime,image_base64:prepared.image_base64});
    if(!r.ok)throw new Error(r.error||"upload_failed");
    profile={...profile,photo_url:r.photo_url||null};store("vybeProfile",profile);renderProfile();await loadPeople();
    analyticsCapture("photo_updated");
    tg?.HapticFeedback?.notificationOccurred("success");showAlert("Фото профілю оновлено ✅");
  }catch(e){
    console.error("VYBE photo upload",e);
    showAlert("Не вдалося завантажити фото. Обери JPG/PNG/WebP до 12 МБ.");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=profile?.photo_url?"Змінити фото":"Додати фото"}
  }
}
async function removeProfilePhoto(){
  if(!profile?.photo_url)return;
  const ok=await confirmAction("Видалити фото профілю?");
  if(!ok)return;
  const r=await secureApi("photo_remove");
  if(!r.ok){showAlert("Не вдалося видалити фото.");return}
  profile={...profile,photo_url:null};store("vybeProfile",profile);renderProfile();await loadPeople();
  analyticsCapture("photo_removed");
}

function openDiscoverFilters(options={}){
  setSheetFullscreen(false);
  const f=discoverFilters||{};
  content.innerHTML='<h2>Фільтри 🔎</h2><div class="filterTwo"><label>Вік від<input id="filterMinAge" class="field" type="number" min="18" max="99" value="'+escapeHtml(f.minAge||18)+'"></label><label>до<input id="filterMaxAge" class="field" type="number" min="18" max="99" value="'+escapeHtml(f.maxAge||99)+'"></label></div><label>Місто<input id="filterCity" class="field" maxlength="40" placeholder="Напр. Київ" value="'+escapeHtml(f.city||"")+'"></label><label class="checkRow filterCheck"><input id="filterOnline" type="checkbox" '+(f.onlineOnly?"checked":"")+'><span>Лише онлайн зараз</span></label><label class="checkRow filterCheck"><input id="filterVerified" type="checkbox" '+(f.verifiedOnly?"checked":"")+'><span>Лише верифіковані</span></label><h3>'+uiText('Інтереси')+'</h3><p class="fieldHint">'+uiText('Будь-який з обраних інтересів')+'</p>'+interestPickerMarkup('filterInterestChoices',f.interests)+'<label class="checkRow filterCheck"><input id="filterCommon" type="checkbox" '+(f.commonOnly?'checked':'')+'><span>'+uiText('Лише зі спільними інтересами')+'</span></label><button id="saveFilters" class="primary">Застосувати</button><button id="resetFilters" class="choice filterReset">Скинути фільтри</button>';
  sheet.classList.remove("hidden");
  const readFilterInterests=bindInterestPicker("filterInterestChoices",f.interests);
  $("saveFilters").onclick=async()=>{
    if($("filterCommon").checked&&!normalizeInterests(profile?.interests).length){showAlert("Додай інтереси в анкету, щоб шукати спільні.");return}
    const minAge=Math.max(18,Math.min(99,Number($("filterMinAge").value)||18));
    const maxAge=Math.max(minAge,Math.min(99,Number($("filterMaxAge").value)||99));
    discoverFilters={minAge,maxAge,city:$("filterCity").value.trim(),onlineOnly:$("filterOnline").checked,verifiedOnly:$("filterVerified").checked,interests:readFilterInterests(),commonOnly:$("filterCommon").checked};
    store("vybeDiscoverFilters",discoverFilters);sheet.classList.add("hidden");
    analyticsCapture("discover_filters_applied",{age_filter:minAge!==18||maxAge!==99,city_filter:!!discoverFilters.city,online_only:discoverFilters.onlineOnly,verified_only:discoverFilters.verifiedOnly});
    await loadPeople();if(options.returnMap)openPeopleMap();
  };
  $("resetFilters").onclick=async()=>{
    sheet.classList.add("hidden");
    await resetDiscoveryFilters();if(options.returnMap)openPeopleMap();
  };
}
function discoveryFiltersActive(){
  const f=discoverFilters||{};
  return filter!=="Усе"||Number(f.minAge||18)!==18||Number(f.maxAge||99)!==99||!!String(f.city||"").trim()||f.onlineOnly===true||f.verifiedOnly===true||normalizeInterests(f.interests).length>0||f.commonOnly===true;
}
async function resetDiscoveryFilters(){
  discoverFilters={minAge:18,maxAge:99,city:"",onlineOnly:false,verifiedOnly:false,interests:[],commonOnly:false};
  store("vybeDiscoverFilters",discoverFilters);
  filter="Усе";
  index=0;
  document.querySelectorAll(".mood").forEach(x=>x.classList.toggle("active",x.dataset.mood==="Усе"));
  await loadPeople();
}
function validNow(){return now&&isSupportedIntent(now.intent)&&now.expires>Date.now()}
function renderNow(){
  const setNowBtn=$("setNow");
  document.querySelector(".nowCard")?.classList.toggle("isActive",!!validNow());
  if(!validNow()){
    now=null;localStorage.removeItem("vybeNow");
    $("nowLabel").textContent=uiText("Твій вайб зараз");
    $("nowTime").textContent=uiText("Покажи, чого хочеш саме зараз");
    if(setNowBtn)setNowBtn.textContent=uiText("Задати");
    return
  }
  $("nowLabel").textContent=now.icon+" "+uiText(now.intent);
  $("nowTime").textContent=vibeTimeLeft(new Date(now.expires).toISOString());
  if(setNowBtn)setNowBtn.textContent=uiText("Змінити");
}
const sheet=$("sheet"),content=$("sheetContent");
const sheetPresentationObserver=new MutationObserver(()=>{
  sheet.classList.toggle("sheetChat",!!content.querySelector(".chatComposer"));
});
sheetPresentationObserver.observe(content,{childList:true});
function setSheetFullscreen(enabled){
  sheet.classList.toggle("sheetFullscreen",enabled===true);
}
function closeSheetView(){
  chatMedia?.disposeRecording();
  sendTyping(activeChat?.matchId,false);
  activeChat=null;
  syncMatchRealtimeChannels();
  clearTimeout(typingStopTimer);
  clearTimeout(incomingTypingTimer);
  sheet.classList.add("hidden");
  destroyVibeMap();
  setSheetFullscreen(false);
  tg?.BackButton?.hide?.();
}
$("closeSheet").onclick=closeSheetView;
tg?.BackButton?.onClick?.(()=>{if(!sheet.classList.contains("hidden"))closeSheetView()});
const sheetObserver=new MutationObserver(()=>{
  if(sheet.classList.contains("hidden"))tg?.BackButton?.hide?.();
  else tg?.BackButton?.show?.();
});
sheetObserver.observe(sheet,{attributes:true,attributeFilter:["class"]});
function openSheet(type){setSheetFullscreen(type==="premium");let h="";if(type==="now")h='<h2>Твій VYBE NOW ⚡</h2><p>Що ти хочеш саме зараз?</p><div class="choiceGrid">'+Object.entries(INTENT_ICONS).map(([intent,icon])=>'<button class="choice" data-intent="'+intent+'" data-icon="'+icon+'">'+icon+" "+intent+"</button>").join("")+'</div><p>На скільки?</p><div class="choiceGrid"><button class="choice duration selected" data-hours="1">1 година</button><button class="choice duration" data-hours="3">3 години</button><button id="smartDuration" class="choice duration" data-smart="1">До ранку</button></div><button id="saveNow" class="primary">Увімкнути VYBE NOW</button>';else if(type==="premium"){h='<h2>'+uiText("Мої бонуси ✨")+'</h2><div class="empty">'+uiText("Завантажуємо магазин…")+'</div>';} else if(type==="filter")h='<h2>Фільтри</h2><p>Вік, місто, дистанція, кого шукаєш, онлайн та верифікація — наступний етап.</p><button class="primary" onclick="document.getElementById(\'sheet\').classList.add(\'hidden\')">Готово</button>';else if(type==="safety")h='<h2>Безпека 🛡</h2><p>VYBE працює тільки для 18+. Блокування та скарги вже захищені серверною перевіркою: заблоковані користувачі не бачать одне одного у пошуку, збігах і чатах.</p><button id="openBlockedFromSafety" class="choice safetyChoice">🚫 Мої блокування</button><p class="safetyHint">Якщо бачиш погрози, шантаж, неповнолітнього користувача, незаконний контент або пропозиції сексуальних послуг — надішли скаргу з профілю/чату.</p>';else h='<h2>VYBE</h2>';content.innerHTML=h;sheet.classList.remove("hidden");tg?.BackButton?.show?.();requestAnimationFrame(()=>{const card=sheet.querySelector(".sheetCard");if(card)card.scrollTop=0});if(type==="safety"){const b=$("openBlockedFromSafety");if(b)b.onclick=openBlockedUsers}if(type==="premium"){renderPremiumShop()}if(type==="now"){let chosen=null,hours=1;
const smart=content.querySelector("#smartDuration");
if(smart){const d=new Date(),hour=d.getHours();let target=new Date(d);
if(hour<8){target.setHours(8,0,0,0);smart.textContent="До ранку";}
else if(hour<18){target.setHours(20,0,0,0);smart.textContent="До вечора";}
else{target.setDate(target.getDate()+1);target.setHours(8,0,0,0);smart.textContent="До ранку";}
smart.dataset.until=String(target.getTime());}content.querySelectorAll(".choice[data-intent]").forEach(b=>b.onclick=()=>{content.querySelectorAll(".choice[data-intent]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");chosen={intent:b.dataset.intent,icon:b.dataset.icon}});content.querySelectorAll(".duration").forEach(b=>b.onclick=()=>{content.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");hours=b.dataset.smart?Math.max(1,(Number(b.dataset.until)-Date.now())/3600000):+b.dataset.hours});$("saveNow").onclick=async()=>{if(!chosen){showAlert("Спочатку обери свій вайб.");return}now={...chosen,expires:Date.now()+hours*3600000};store("vybeNow",now);renderNow();filter=chosen.intent;document.querySelectorAll(".mood").forEach(x=>x.classList.toggle("active",x.dataset.mood===filter));const saved=await syncNow(hours);if(saved){analyticsCapture("vybe_now_set");await loadPeople()}sheet.classList.add("hidden");tg?.HapticFeedback?.notificationOccurred("success")}}}
$("setNow").onclick=()=>openSheet("now");$("premiumBtn").onclick=()=>openSheet("premium");$("notificationBtn").onclick=()=>openNotificationCenter();$("filterBtn").onclick=openDiscoverFilters;$("safetyBtn").onclick=()=>openSheet("safety");
function people(){return remotePeople}
function filtered(){
  const nowMs=Date.now();
  const arr=people().filter(p=>!p.expires_at||new Date(p.expires_at).getTime()>nowMs);
  return filter==="Усе"?arr:arr.filter(p=>p.intent===filter);
}
function vibeTimeLeft(expiresAt){
  if(!expiresAt)return "";
  const ms=new Date(expiresAt).getTime()-Date.now();
  if(!Number.isFinite(ms)||ms<=0)return "";
  const min=Math.max(1,Math.ceil(ms/60000));
  if(min<60)return uiText("активний ще")+" "+min+" "+uiText("хв.");
  const hours=Math.floor(min/60),rest=min%60;
  return currentLang==="en"
    ? "active for "+hours+"h"+(rest?" "+rest+"m":"")
    : "активний ще "+hours+" год."+(rest?" "+rest+" хв.":"");
}
function renderCard(){
  const arr=filtered();
  const stack=$("cardStack"),actions=$("discoverActions");
  if(!arr.length||index>=arr.length){
    if(discoverHasMore){
      if(actions)actions.classList.add("hidden");
      stack.classList.add("emptyStack");
      stack.innerHTML='<div class="discoverEmpty"><div class="discoverEmptyIcon">'+uiIcon("discover")+'</div><h3>'+uiText("Завантаження…")+'</h3></div>';
      if(!discoverLoading)void loadMorePeople();
      return
    }
    if(actions)actions.classList.add("hidden");
    stack.classList.add("emptyStack");
    const hasFilters=discoveryFiltersActive();
    const hasVibe=validNow()||filter!=="Усе";
    const emptyTitle=hasVibe?uiText("Зараз нікого з таким вайбом немає."):uiText("Зараз немає активних анкет.");
    const emptyText=hasVibe?uiText("Зміни VYBE NOW або спробуй інші умови."):uiText("Нові активні VYBE NOW з’являться тут.");
    const secondary=hasFilters?uiText("↺ Скинути фільтри"):uiText("↻ Оновити пошук");
    stack.innerHTML='<div class="discoverEmpty"><div class="discoverEmptyIcon">'+uiIcon("discover")+'</div><h3>'+emptyTitle+'</h3><p>'+emptyText+'</p><div class="discoverEmptyActions"><button id="emptySecondary" class="primary">'+secondary+'</button></div></div>';
    const secondaryBtn=$("emptySecondary");if(secondaryBtn)secondaryBtn.onclick=async()=>{secondaryBtn.disabled=true;try{if(hasFilters)await resetDiscoveryFilters();else await loadPeople()}finally{if($("emptySecondary"))$("emptySecondary").disabled=false}};
    return
  }
  stack.classList.remove("emptyStack");
  if(actions)actions.classList.remove("hidden");
  const p=arr[index];
  const visual=p.img?'<img src="'+escapeHtml(p.img)+'" alt="'+escapeHtml(p.name)+'">':'<div class="generatedAvatar">'+escapeHtml(p.name?.[0]||"V")+'</div>';
  const liveBadges='<div class="discoveryBadges">'+(p.spotlight_active?'<span class="discoveryBadge spotlightBadge">✦ Spotlight</span>':'')+(p.online?'<span class="discoveryBadge onlineBadge">● '+uiText("онлайн")+'</span>':'')+'</div>';
  const timeLeft=vibeTimeLeft(p.expires_at);
  const vibeLive='<div class="vibeNowLive"><span><b>VYBE NOW</b> '+escapeHtml(p.icon)+" "+escapeHtml(p.intent)+'</span>'+(timeLeft?'<small>'+escapeHtml(timeLeft)+'</small>':'')+'</div>';
  const facts='<div class="profileFacts">'+(p.city?'<span>'+uiIcon("location")+escapeHtml(p.city)+'</span>':'')+(p.verified?'<span class="verifiedFact">'+uiIcon("check")+uiText("Верифіковано")+'</span>':'')+'</div>';
  $("cardStack").innerHTML='<article class="personCard '+(p.spotlight_active?"spotlightCard":"")+'">'+visual+liveBadges+'<button id="cardSafetyBtn" class="cardSafety" aria-label="Безпека">⋯</button><div class="gradient"></div><div class="personMeta"><div class="nameRow"><h2>'+escapeHtml(p.name)+", "+escapeHtml(p.age)+'</h2></div>'+vibeLive+'<p class="bio">'+escapeHtml(p.bio)+'</p><div class="interestTags cardInterests">'+interestTags(p.interests,p.common_interests,2)+'</div>'+facts+'<button id="cardProfileBtn" class="profilePeek">'+uiText("Переглянути анкету")+'</button></div></article>';
  const safety=$("cardSafetyBtn");if(safety)safety.onclick=e=>{e.stopPropagation();openUserSafety(p.id,p.name)};
  const profileBtn=$("cardProfileBtn");if(profileBtn)profileBtn.onclick=e=>{e.stopPropagation();openPublicProfile(p.id)};
  if(discoverHasMore&&!discoverLoading&&arr.length-index<=3)void loadMorePeople();
}
function updateUnreadBadge(total){const nav=[...document.querySelectorAll(".navItem")].find(x=>x.dataset.target==="chatView");if(!nav)return;let badge=nav.querySelector(".navUnread");if(!badge){badge=document.createElement("b");badge.className="navUnread";nav.appendChild(badge)}badge.textContent=total>99?"99+":String(total);badge.classList.toggle("hidden",!total)}
async function loadMatches(){
  const r=await secureApi("matches");if(!r.ok)return false;
  matches=(r.matches||[]).map(m=>({
    match_id:m.match_id,
    realtime_topic:m.realtime_topic||null,
    created_at:m.created_at||null,
    id:m.user_id,
    name:m.profile?.name||"VYBE",
    age:m.profile?.age||"",
    city:m.profile?.city||"",
    bio:m.profile?.bio||"",
    photo_url:m.profile?.photo_url||null,
    verified:m.profile?.verified===true,
    online:m.profile?.online===true,
    icon:"♡",
    unread_count:Number(m.unread_count||0),
    last_message:m.last_message||"",
    last_message_at:m.last_message_at||null,
  }));
  updateUnreadBadge(Number(r.unread_total||0));
  syncMatchRealtimeChannels();
  renderMatches();renderChats();return true;
}
function openMatchSuccess(target){
  const match=matches.find(x=>String(x.id)===String(target?.id));
  if(!match){showAlert("У вас взаємний VYBE 💜");return}
  const visual=match.photo_url
    ? '<img class="matchSuccessPhoto" src="'+escapeHtml(match.photo_url)+'" alt="'+escapeHtml(match.name)+'">'
    : '<div class="matchSuccessFallback">'+escapeHtml((match.name||"V").trim().charAt(0).toUpperCase())+'</div>';
  content.innerHTML='<div class="matchSuccess"><div class="matchSuccessGlow"></div>'+visual+'<div class="matchSuccessMark">♡</div><h2>'+uiText("Взаємний VYBE 💜")+'</h2><p>'+escapeHtml(match.name||"VYBE")+'</p><button id="matchChatNow" class="primary">'+uiText("Написати зараз")+'</button><button id="matchKeepBrowsing" class="choice">'+uiText("Продовжити перегляд")+'</button></div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  secureApi("notifications_mark_seen",{match_id:match.match_id}).then(async seen=>{
    if(seen?.ok){
      const marked=Number(seen.marked||0);
      if(marked>0)notificationUnread=Math.max(0,Number(notificationUnread||0)-marked);
      renderNotificationBadge();
      await loadSupportCounts();
    }
  }).catch(()=>{});
  const chat=$("matchChatNow");if(chat)chat.onclick=()=>openChat(match.match_id,match.name,match.id);
  const keep=$("matchKeepBrowsing");if(keep)keep.onclick=()=>{sheet.classList.add("hidden");tg?.BackButton?.hide?.()};
}
async function next(kind){
  const arr=filtered(),p=arr[index];
  if(kind==="skip"&&p&&!p.already_matched&&!String(p.id).startsWith("demo")){
    const passRequest=secureApi("pass",{target_user_id:p.id});
    analyticsCapture("profile_passed");
    index++;renderCard();tg?.HapticFeedback?.impactOccurred("light");
    await passRequest;
    return
  }
  if(p?.already_matched&&(kind==="like"||kind==="super")){
    await openPublicProfile(p.id);
    return
  }
  if((kind==="like"||kind==="super")&&p){
    if(String(p.id).startsWith("demo")){showAlert("Це демо-анкета. Реальна дія працює тільки для реальних користувачів.");return}
    if(kind==="super"){
      await loadEntitlements();
      if(Number(entitlements?.balances?.supervybe||0)<1){openSheet("premium");return}
    }
    const r=kind==="super"
      ? await secureApi("super_like",{target_user_id:p.id})
      : await secureApi("like",{target_user_id:p.id,kind:"like"});
    if(!r.ok){showAlert(kind==="super"?"SuperVYBE не списано. Спробуй ще раз.":"Не вдалося надіслати VYBE. Спробуй ще раз.");return}
    if(kind==="super")await loadEntitlements();
    analyticsCapture(kind==="super"?"supervybe_sent":"like_sent");
    if(r.matched){analyticsCapture("match_created");await loadMatches();tg?.HapticFeedback?.notificationOccurred("success");openMatchSuccess(p)}
    else if(kind==="super")showAlert("SuperVYBE надіслано ✦")
  }
  index++;renderCard();tg?.HapticFeedback?.impactOccurred("light");
}
$("skipBtn").onclick=()=>next("skip");$("likeBtn").onclick=()=>next("like");$("sparkBtn").onclick=()=>next("super");document.querySelectorAll(".mood").forEach(b=>b.onclick=async()=>{document.querySelectorAll(".mood").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.mood;index=0;await loadPeople()});

function uiIcon(name){return '<svg class="uiIcon" aria-hidden="true"><use href="#ui-'+name+'"></use></svg>'}
function emptyStateMarkup(icon,title,hint){return '<div class="emptyState"><div class="emptyStateIcon">'+uiIcon(icon)+'</div><h3>'+escapeHtml(uiText(title))+'</h3><p>'+escapeHtml(uiText(hint))+'</p></div>'}
function avatarMarkup(photo,name,className="avatar"){
  const initial=escapeHtml((name||"V").trim().charAt(0).toUpperCase()||"V");
  return '<span class="'+className+' avatarShell"><span class="avatarInitial">'+initial+'</span>'+(photo?'<img data-avatar-img src="'+escapeHtml(photo)+'" alt="">':"")+'</span>';
}
function bindAvatarFallbacks(root=document){
  root.querySelectorAll?.("img[data-avatar-img]").forEach(img=>{
    if(img.dataset.fallbackBound==="1")return;
    img.dataset.fallbackBound="1";
    img.addEventListener("error",()=>img.remove(),{once:true});
  });
}

function renderMatches(){
  const list=$("matchesList");
  $("matchCount").textContent=matches.length;
  list.innerHTML=matches.length
    ? matches.map((p,i)=>'<button type="button" class="listItem matchOpen" data-index="'+i+'">'+avatarMarkup(p.photo_url,p.name,'avatar matchAvatar')+'<span class="matchMark">'+uiIcon("heart")+'</span><div class="itemMain"><b>'+escapeHtml(p.name)+(p.age?", "+escapeHtml(p.age):"")+(p.verified?' ✓':'')+'</b><small>'+uiText("Взаємний VYBE")+'</small>'+(p.city?'<small class="matchCity">'+escapeHtml(p.city)+(p.online?" • "+uiText("● онлайн"):"")+'</small>':p.online?'<small class="matchCity">'+uiText("● онлайн")+'</small>':'')+'</div></button>').join("")
    : emptyStateMarkup("heart","Поки немає взаємних збігів.","Лайкни анкету — взаємний VYBE відкриє чат.");
  bindAvatarFallbacks(list);
  list.querySelectorAll(".matchOpen").forEach(b=>{
    b.onclick=()=>{
      const p=matches[Number(b.dataset.index)];
      if(!p)return;
      openChat(p.match_id,p.name,p.id);
    };
  });
}
function renderChats(){
  const list=$("chatList");
  const rows=[...matches].sort((a,b)=>{
    const bt=new Date(b.last_message_at||b.created_at||0).getTime();
    const at=new Date(a.last_message_at||a.created_at||0).getTime();
    return bt-at;
  });
  list.innerHTML=rows.length?rows.map((p,i)=>{
    const unread=Number(p.unread_count||0);
    const isNewMatch=!p.last_message;
    const subtitle=p.last_message?escapeHtml(p.last_message==="🎙 Голосове повідомлення"?(currentLang==="en"?"🎙 Voice message":p.last_message):p.last_message==="🎥 Відеоповідомлення"?(currentLang==="en"?"🎥 Video message":p.last_message):p.last_message):uiText("Новий взаємний VYBE ✨");
    const time=formatChatListTime(p.last_message_at||p.created_at);
    return '<div class="listItem chatRow '+(unread?"hasUnread ":"")+(isNewMatch?"newMatchRow":"")+'"><button type="button" class="chatAvatarOpen" data-index="'+i+'" aria-label="'+escapeHtml(uiText("Переглянути анкету"))+'">'+avatarMarkup(p.photo_url,p.name,'avatar')+'</button><button type="button" class="chatOpen chatMainOpen" data-index="'+i+'"><div class="itemMain"><b>'+escapeHtml(p.name)+(p.age?", "+escapeHtml(p.age):"")+(p.online?' <span class="onlineMini">●</span>':'')+'</b><small>'+subtitle+'</small></div><div class="chatTail">'+(time?'<small class="chatTime">'+escapeHtml(time)+'</small>':'')+(unread?'<span class="unreadBadge">'+unread+'</span>':isNewMatch?'<span class="newMatchDot">✨</span>':'')+'</div><span class="chevron">›</span></button></div>';
  }).join(""):emptyStateMarkup("chat","Чати з’являться після взаємних збігів.","Тут будуть твої розмови після взаємного VYBE.");
  bindAvatarFallbacks(list);
  list.querySelectorAll(".chatOpen").forEach(b=>b.onclick=()=>{
    const p=rows[Number(b.dataset.index)];if(p)openChat(p.match_id,p.name,p.id);
  });
  list.querySelectorAll(".chatAvatarOpen").forEach(b=>b.onclick=()=>{
    const p=rows[Number(b.dataset.index)];if(p)openPublicProfile(p.id);
  });
}
async function openChat(matchId,name,userId,options={}){
  const requestId=++chatRequestId;
  const key=String(matchId);
  const keepDom=options.silent&&activeChat?.matchId===key&&$("chatMessage")&&!sheet.classList.contains("hidden");
  const previousBox=$("chatMessages");
  const previousDraft=options.preserveDraft&&activeChat?.matchId===key?($("chatMessage")?.value||""):"";
  const stickToBottom=!previousBox||(previousBox.scrollHeight-previousBox.scrollTop-previousBox.clientHeight<90);
  const previousDistance=previousBox?previousBox.scrollHeight-previousBox.scrollTop:0;

  const [r,peerResult]=await Promise.all([
    secureApi("messages_list",{match_id:matchId}),
    secureApi("profile_public",{target_user_id:userId}),
  ]);
  if(requestId!==chatRequestId||(options.silent&&activeChat?.matchId!==key))return;
  if(!r.ok){
    if(options.silent){chatMedia?.disposeRecording();activeChat=null;sheet.classList.add("hidden");await loadMatches();return}
    showAlert("Не вдалося відкрити чат.");return
  }

  activeChat={matchId:key,name,userId:String(userId)};
  if(!options.silent&&!options.noMatchRefresh)analyticsCapture("chat_opened");
  syncMatchRealtimeChannels();
  const matchPeer=matches.find(x=>String(x.match_id)===key)||null;
  const peerProfile=peerResult?.ok?peerResult.profile:null;
  const peerPhoto=peerProfile?.photo_url||matchPeer?.photo_url||null;
  const ownPhoto=profile?.photo_url||null;
  const peerName=peerProfile?.name||name||matchPeer?.name||"VYBE";
  const peerReadAt=r.peer_last_read_at?new Date(r.peer_last_read_at).getTime():0;
  const messages=r.messages||[];
  const msgs=messages.map(m=>{
    const mine=String(m.sender_id)===String(profile?.user_id);
    const sender=mine?uiText("Ти"):peerName;
    const createdAt=new Date(m.created_at).getTime();
    const wasRead=mine&&!!peerReadAt&&createdAt<=peerReadAt;
    const receipt=mine?'<span class="msgReceipt '+(wasRead?"read":"sent")+'" title="'+escapeHtml(uiText(wasRead?"Прочитано":"Надіслано"))+'">'+(wasRead?"✓✓":"✓")+'</span>':"";
    const meta='<span>'+escapeHtml(formatMessageTime(m.created_at))+'</span>'+receipt;
    const avatar=avatarMarkup(mine?ownPhoto:peerPhoto,sender,'msgAvatar');
    return '<div data-message-id="'+escapeHtml(m.id)+'" class="msgRow '+(mine?"mine":"theirs")+'">'+avatar+'<div class="msgWrap"><div class="msgSender">'+escapeHtml(sender)+'</div><div class="msgBubble">'+(m.kind==='voice'||m.kind==='video'?chatMedia.messageMarkup(m):escapeHtml(m.body))+'</div><div class="msgMeta">'+meta+'</div></div></div>';
  }).join("");

  const idlePresence=peerProfile?.online?uiText("● онлайн"):chatConnectionLabel();
  if(keepDom){
    const template=document.createElement('template');template.innerHTML=msgs;
    const box=$("chatMessages"),ids=new Set(messages.map(m=>String(m.id)));
    box.querySelector('.chatEmpty')?.remove();
    box.querySelectorAll('.msgRow').forEach(row=>{if(!ids.has(row.dataset.messageId)){row.querySelectorAll('audio,video').forEach(p=>p.pause());row.remove()}});
    const existing=new Map([...box.querySelectorAll('.msgRow')].map(row=>[row.dataset.messageId,row]));
    for(const row of template.content.children){const old=existing.get(row.dataset.messageId);if(old)old.querySelector('.msgMeta').innerHTML=row.querySelector('.msgMeta').innerHTML;else box.append(row.cloneNode(true))}
    if(!messages.length)box.innerHTML='<div class="chatEmpty">'+uiText('Почни розмову 👋')+'</div>';
  }else{
    chatMedia?.disposeRecording();
  content.innerHTML='<div class="chatHeader"><button id="chatPeerBtn" class="chatPeer" type="button">'+avatarMarkup(peerPhoto,peerName,'chatAvatar')+'<div class="chatTitle"><h2>'+escapeHtml(peerName)+'</h2><small><span id="chatPresence" data-idle-label="'+escapeHtml(idlePresence)+'">'+escapeHtml(idlePresence)+'</span></small></div></button><button id="chatSafetyBtn" class="chatSafety" aria-label="Безпека">⋯</button></div><button id="chatProfileBtn" class="chatProfileAction" type="button"><span>'+uiIcon("user")+uiText("Переглянути анкету")+'</span>'+uiIcon("chevron")+'</button><div id="chatMessages" class="chatMessages">'+(msgs||'<div class="chatEmpty">Почни розмову 👋</div>')+'</div><div class="chatComposer"><textarea id="chatMessage" class="field" maxlength="2000" placeholder="Напиши повідомлення…"></textarea><button id="sendMessage" class="primary sendButton" aria-label="'+escapeHtml(uiText("Надіслати"))+'" title="'+escapeHtml(uiText("Надіслати"))+'">'+uiIcon("send")+'</button></div>';
  }
  sheet.classList.add("sheetChat");
  sheet.classList.remove("hidden");
  chatMedia?.mount();
  bindAvatarFallbacks(content);

  const openPeerProfile=()=>openPublicProfile(userId,{returnChat:{matchId,name:peerName,userId}});
  const peer=$("chatPeerBtn");if(peer)peer.onclick=openPeerProfile;
  const profileBtn=$("chatProfileBtn");if(profileBtn)profileBtn.onclick=openPeerProfile;
  const safety=$("chatSafetyBtn");if(safety)safety.onclick=()=>openUserSafety(userId,peerName);
  const field=$("chatMessage");if(field&&previousDraft)field.value=previousDraft;
  bindTyping(key);

  const box=$("chatMessages");
  if(box){
    if(stickToBottom)box.scrollTop=box.scrollHeight;
    else box.scrollTop=Math.max(0,box.scrollHeight-previousDistance);
  }

  const current=matches.find(x=>String(x.match_id)===key);
  if(current){
    current.unread_count=0;
    renderChats();
    updateUnreadBadge(matches.reduce((sum,m)=>sum+Number(m.unread_count||0),0));
  }
  secureApi("notifications_mark_seen",{match_id:key}).then(seen=>{
    const marked=Number(seen?.marked||0);
    if(seen?.ok&&marked>0){
      notificationUnread=Math.max(0,Number(notificationUnread||0)-marked);
      renderNotificationBadge();
    }
  }).catch(()=>{});
  if(!options.noMatchRefresh)loadMatches();

  $("sendMessage").onclick=async()=>{
    const composerField=$("chatMessage"),sendBtn=$("sendMessage");
    const message=composerField.value.trim();if(!message)return;
    sendTyping(key,false);clearTimeout(typingStopTimer);
    $("sendMessage").disabled=true;
    const x=await secureApi("message_send",{match_id:matchId,message});
    sendBtn.disabled=false;
    if(!x.ok){showAlert("Не вдалося надіслати повідомлення.");return}
    if(composerField.isConnected&&composerField.value.trim()===message)composerField.value="";
    if(activeChat?.matchId!==key){loadMatches();return}
    analyticsCapture("message_sent");
    await openChat(matchId,name,userId,{silent:true,preserveDraft:true,noMatchRefresh:true});
    loadMatches();
    tg?.HapticFeedback?.notificationOccurred("success");
  };
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
document.querySelectorAll(".navItem").forEach(b=>b.onclick=()=>{document.querySelectorAll(".navItem").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(b.dataset.target).classList.add("active")});setInterval(()=>{renderNow();if($("discoverView")?.classList.contains("active"))renderCard()},60000);

function openLegalPage(page){
  const safe=["privacy.html","terms.html","community.html"].includes(page)?page:"privacy.html";
  const url=new URL("./"+safe,location.href).href;
  analyticsCapture("legal_opened",{document:safe.replace(".html","")});
  if(tg?.openLink)tg.openLink(url);
  else window.open(url,"_blank","noopener,noreferrer");
}

function openPrivacyInfo(){
  content.innerHTML='<h2>Приватність 🔐</h2><p>VYBE використовує Telegram-авторизацію та зберігає лише дані, потрібні для роботи сервісу: Telegram ID, анкету, фото, VYBE NOW, лайки, збіги, приватні повідомлення, блокування, скарги та бонуси.</p><p>Фото зберігаються у Supabase Storage. Тексти приватних повідомлень не передаються в Realtime Broadcast — через realtime передаються лише технічні сигнали про зміни.</p><p>Ти можеш видалити акаунт у Налаштуваннях. Соціальні дані та звернення в підтримку видаляються; мінімальні записи про завершені платежі можуть зберігатися окремо для повернення Stars і фінансової звірки.</p><button id="fullPrivacyBtn" class="choice safetyChoice">'+uiText("Повна політика приватності")+'</button>';
  sheet.classList.remove("hidden");
  $("fullPrivacyBtn").onclick=()=>openLegalPage("privacy.html");
}

function openCommunityRules(){
  content.innerHTML='<h2>Правила спільноти 🛡</h2><p>VYBE — лише для повнолітніх 18+.</p><p>Заборонені: примус, шантаж, переслідування, шахрайство, видавання себе за іншу людину, участь неповнолітніх, продаж сексуальних послуг та незаконний контент.</p><p>Для небезпечного або підозрілого профілю використовуй «Поскаржитися» або «Заблокувати».</p><button id="fullRulesBtn" class="choice safetyChoice">'+uiText("Повні правила спільноти")+'</button>';
  sheet.classList.remove("hidden");
  $("fullRulesBtn").onclick=()=>openLegalPage("community.html");
}

function openRestrictionNotice(){
  content.innerHTML='<div class="restrictionNotice"><div class="restrictionIcon">🛡</div><h2>'+uiText("Твій акаунт тимчасово обмежено")+'</h2><p>'+uiText("Соціальні функції VYBE недоступні, поки обмеження активне. Ти можеш звернутися у підтримку або видалити акаунт.")+'</p>'+(restrictionReason?'<div class="restrictionReason"><b>'+uiText("Причина обмеження")+'</b><span>'+escapeHtml(moderationReasonLabel(restrictionReason))+'</span></div>':'')+'<button id="restrictedSupportBtn" class="primary">'+uiText("Звернутися у підтримку")+'</button><button id="restrictedDeleteBtn" class="choice">'+uiText("🗑 Видалити акаунт")+'</button></div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  $("restrictedSupportBtn").onclick=openSupportInfo;
  $("restrictedDeleteBtn").onclick=openDeleteAccount;
}
function moderationReasonLabel(reason){
  const labels={
    fake_profile:uiText("Фейковий профіль"),
    spam:uiText("Спам"),
    harassment:uiText("Переслідування або домагання"),
    underage:uiText("Підозра на неповнолітнього"),
    sexual_services:uiText("Сексуальні послуги"),
    illegal_content:uiText("Незаконний або небезпечний контент"),
    other:uiText("Інша причина"),
  };
  return labels[reason]||String(reason||"");
}
function moderationStatusLabel(status){
  return status==="open"?uiText("Відкрите"):status==="reviewed"?uiText("В роботі"):status==="resolved"?uiText("Вирішено"):status==="dismissed"?uiText("Відхилено"):String(status||"");
}

function supportStatusLabel(status){
  return status==="open"?uiText("Відкрите"):status==="reviewed"?uiText("В роботі"):status==="resolved"?uiText("Вирішено"):String(status||"");
}
async function openSupportInfo(){
  content.innerHTML='<h2>'+uiText("Підтримка VYBE ⚑")+'</h2><div class="supportReportHint"><b>⚑ '+uiText("Потрібно поскаржитися на конкретного користувача? Відкрий його анкету або чат → ⋯ → «Поскаржитися».")+'</b><span>'+uiText("Звернення тут — це технічна або платіжна підтримка, а не скарга на користувача.")+'</span></div><p class="safetyHint">'+uiText("Технічні помилки зараз фіксуємо під час beta-тестування. Не надсилай у скаргах паролі, банківські дані чи інші секрети.")+'</p><h3>'+uiText("Нове звернення")+'</h3><select id="supportCategory" class="field"><option value="general">'+uiText("Загальне питання")+'</option><option value="payment">'+uiText("Проблема з оплатою")+'</option></select><textarea id="supportMessage" class="field supportMessage" maxlength="1500" placeholder="'+uiText("Опиши проблему")+'"></textarea><button id="supportSubmitBtn" class="primary">'+uiText("Надіслати у підтримку")+'</button><h3>'+uiText("Мої звернення")+'</h3><div id="mySupportTickets"><div class="empty">'+uiText("Завантаження…")+'</div></div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const list=$("mySupportTickets");
  const mine=await secureApi("support_my");
  if(mine.ok){
    const rows=mine.tickets||[];
    list.innerHTML=rows.length?rows.map(t=>'<div class="myTicket '+(t.unread_reply?"unread":"")+'"><div class="myTicketHead"><b>'+escapeHtml(t.category==="payment"?uiText("Проблема з оплатою"):uiText("Загальне питання"))+(t.unread_reply?' <span class="ticketUnread">●</span>':'')+'</b><span class="supportStatus '+escapeHtml(t.status)+'">'+escapeHtml(supportStatusLabel(t.status))+'</span></div><p>'+escapeHtml(t.message)+'</p><small>'+escapeHtml(adminDate(t.created_at))+'</small>'+(t.reply_text?'<div class="supportReply"><b>'+uiText("Відповідь підтримки")+'</b><p>'+escapeHtml(t.reply_text)+'</p></div>':'')+'</div>').join(""):'<div class="empty">'+uiText("Черга порожня.")+'</div>';
    const unreadIds=rows.filter(t=>t.unread_reply).map(t=>t.id);
    if(unreadIds.length){
      await secureApi("support_mark_seen",{ticket_ids:unreadIds});
      await loadSupportCounts();
    }
  }
  $("supportSubmitBtn").onclick=async()=>{
    const btn=$("supportSubmitBtn");
    const message=$("supportMessage").value.trim();
    if(message.length<3){showAlert("Опиши проблему");return}
    btn.disabled=true;
    const r=await secureApi("support_create",{category:$("supportCategory").value,message});
    btn.disabled=false;
    if(!r.ok){
      showAlert(r.status===429?"Зачекай трохи перед наступним зверненням.":"Не вдалося надіслати звернення.");
      return;
    }
    analyticsCapture("support_request_created",{category:$("supportCategory").value});
    await loadSupportCounts();
    tg?.HapticFeedback?.notificationOccurred("success");
    showAlert("Звернення надіслано ✅");
    await openSupportInfo();
  };
}

function resetLocalVYBE(){
  const keys=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith("vybe"))keys.push(key);
  }
  keys.forEach(key=>localStorage.removeItem(key));
}

async function deleteAccount(){
  const typed=$("deleteConfirmInput")?.value?.trim()||"";
  const button=$("deleteAccountConfirm");
  if(typed!==deleteToken()){
    showAlert(currentLang==="en"?"To confirm, enter the word DELETE.":'Для підтвердження введи слово «ВИДАЛИТИ».');
    return;
  }
  if(button){button.disabled=true;button.textContent="Видаляємо…"}
  const r=await secureApi("account_delete",{confirmation:"ВИДАЛИТИ"});
  if(!r.ok){
    if(button){button.disabled=false;button.textContent=uiText("Видалити акаунт назавжди")}
    if(r.error==="ADMIN_ACCOUNT_DELETE_BLOCKED"){
      showAlert(currentLang==="en"
        ?"Admin/owner accounts must remove or transfer their admin role before deletion."
        :"Admin/owner акаунт спочатку має передати або зняти адміністративну роль.");
    }else{
      showAlert(uiText("Не вдалося видалити акаунт. Спробуй ще раз."));
    }
    return;
  }
  if(realtimeUserChannel&&realtimeClient){try{realtimeClient.removeChannel(realtimeUserChannel)}catch{}}
  for(const entry of realtimeMatchChannels.values()){try{realtimeClient?.removeChannel(entry.channel)}catch{}}
  realtimeMatchChannels.clear();
  analyticsCapture("account_deleted",{},true);
  resetLocalVYBE();
  profile=null;now=null;matches=[];remotePeople=[];activeChat=null;
  sheet.classList.add("hidden");
  tg?.HapticFeedback?.notificationOccurred("success");
  if(tg?.showAlert){
    showAlert("Акаунт VYBE та пов’язані дані видалено.",()=>{try{tg.close()}catch{location.reload()}});
  }else{
    alert("Акаунт VYBE та пов’язані дані видалено.");
    location.reload();
  }
}

function openDeleteAccount(){
  const token=deleteToken();
  content.innerHTML='<h2>'+uiText("Видалити акаунт")+'</h2><p class="dangerText">'+uiText("Ця дія незворотна. Будуть видалені анкета, фото, VYBE NOW, лайки, збіги, повідомлення, блокування, скарги, реферальні дані та бонуси, пов’язані з цим акаунтом.")+'</p><label>'+uiText("Для підтвердження введи ")+'<b>'+token+'</b><input id="deleteConfirmInput" class="field" autocomplete="off" maxlength="20" placeholder="'+token+'"></label><button id="deleteAccountConfirm" class="primary dangerPrimary">'+uiText("Видалити акаунт назавжди")+'</button><button id="cancelDeleteAccount" class="choice filterReset">'+uiText("Скасувати")+'</button>';
  sheet.classList.remove("hidden");
  $("deleteAccountConfirm").onclick=deleteAccount;
  $("cancelDeleteAccount").onclick=()=>sheet.classList.add("hidden");
}

function adminOrderTitle(order){
  return currentLang==="en"?(order.title_en||order.product_key):(order.title_uk||order.product_key);
}
function adminStatusLabel(status){
  const labels={
    paid:currentLang==="en"?"Paid":"Оплачено",
    refunded:currentLang==="en"?"Refunded":"Повернено",
    refunding:currentLang==="en"?"Refunding":"Повертається",
    pending:currentLang==="en"?"Pending":"Очікує",
    failed:currentLang==="en"?"Failed":"Помилка",
    expired:currentLang==="en"?"Expired":"Прострочено",
    cancelled:currentLang==="en"?"Cancelled":"Скасовано",
  };
  return labels[status]||status;
}
function adminDate(value){
  if(!value)return "—";
  const d=new Date(value);if(Number.isNaN(d.getTime()))return "—";
  return d.toLocaleString(uiLocale(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function adminMetricCard(title,data){
  return '<div class="adminMetric"><small>'+uiText(title)+'</small><strong>⭐ '+Number(data?.net_stars||0)+'</strong><span>'+uiText("Валові")+': '+Number(data?.gross_stars||0)+' • '+uiText("Повернення")+': '+Number(data?.refunded_stars||0)+'</span><span>'+uiText("Оплачені")+': '+Number(data?.paid_orders||0)+'</span></div>';
}
async function adminRefundOrder(orderId,stars,title){
  const ok=await confirmAction(uiText("Повернути ")+Number(stars||0)+uiText(" Stars користувачу?")+"\n"+title);
  if(!ok)return;
  const r=await secureApi("admin_refund_star_order",{order_id:orderId,confirmation:"REFUND"});
  if(!r.ok){showAlert("Не вдалося повернути Stars.");return}
  analyticsCapture("admin_star_refund",{stars:Number(r.stars||0)});
  tg?.HapticFeedback?.notificationOccurred("success");
  showAlert("Повернення виконано ✅");
  await openAdminFinance();
}

function financeIssueLabel(code){
  const uk={
    telegram_incoming_missing:"Платіж не знайдений у Telegram",
    telegram_incoming_not_in_scan:"Платіж поза поточним scan",
    amount_mismatch:"Не збігається сума",
    invoice_payload_mismatch:"Не збігається invoice payload",
    telegram_user_mismatch:"Не збігається Telegram user",
    telegram_refunded_local_paid:"Telegram повернув Stars, локально ще paid",
    telegram_refunded_local_refunding:"Telegram повернув Stars, локально ще refunding",
    telegram_refund_mismatch:"Не збігаються дані refund",
    refund_stuck:"Refund завис",
    refund_in_progress:"Refund виконується",
    telegram_refund_missing:"Локально refunded, але refund не знайдено в Telegram",
    telegram_refund_not_in_scan:"Refund поза поточним scan",
    refund_amount_mismatch:"Не збігається сума refund",
    paid_grant_missing:"Оплата є, grant відсутній",
    refunded_grant_still_present:"Refund є, grant ще активний",
    telegram_payment_without_local_order:"Telegram payment без локального order",
    telegram_refund_without_local_order:"Telegram refund без локального order",
  };
  const en={
    telegram_incoming_missing:"Payment not found in Telegram",
    telegram_incoming_not_in_scan:"Payment is outside the current scan",
    amount_mismatch:"Amount mismatch",
    invoice_payload_mismatch:"Invoice payload mismatch",
    telegram_user_mismatch:"Telegram user mismatch",
    telegram_refunded_local_paid:"Telegram refunded, local order still paid",
    telegram_refunded_local_refunding:"Telegram refunded, local order still refunding",
    telegram_refund_mismatch:"Refund data mismatch",
    refund_stuck:"Refund is stuck",
    refund_in_progress:"Refund in progress",
    telegram_refund_missing:"Locally refunded, Telegram refund not found",
    telegram_refund_not_in_scan:"Refund is outside the current scan",
    refund_amount_mismatch:"Refund amount mismatch",
    paid_grant_missing:"Payment exists but grant is missing",
    refunded_grant_still_present:"Refund exists but grant is still active",
    telegram_payment_without_local_order:"Telegram payment without local order",
    telegram_refund_without_local_order:"Telegram refund without local order",
  };
  return (currentLang==="en"?en:uk)[code]||code;
}

function renderFinanceDeepReconciliation(r){
  const root=$("financeDeepRecon");
  if(!root)return;
  if(!r?.ok){
    root.innerHTML='<b>'+(currentLang==="en"?"Deep reconciliation":"Глибока звірка")+'</b><span>'+escapeHtml(r?.error||"Error")+'</span>';
    return;
  }
  const s=r.summary||{},scan=r.scan||{},issues=Array.isArray(r.issues)?r.issues:[];
  const issueHtml=issues.length?issues.slice(0,20).map(x=>{
    const sev=String(x.severity||"info");
    const badge=sev==="critical"?"🔴":sev==="high"?"🟠":"ℹ️";
    return '<div class="adminAttempt"><b>'+badge+' '+escapeHtml(financeIssueLabel(x.code))+'</b><small>'+escapeHtml(String(x.order_id||x.charge_id||"—"))+' • ⭐ '+Number(x.stars||0)+'</small></div>';
  }).join(""):'<div class="empty">'+(currentLang==="en"?"No inconsistencies found ✅":"Розбіжностей не знайдено ✅")+'</div>';
  const scope=scan.telegram_history_complete
    ? (currentLang==="en"?"Telegram history scanned completely":"Історію Telegram проскановано повністю")
    : (currentLang==="en"?"Scan limited to the latest ":"Scan обмежений останніми ")+Number(scan.telegram_scan_limit||0);
  const repairBtn=Number(s.repairable_count||0)>0
    ? '<button id="financeRepairBtn" class="choice">'+(currentLang==="en"?"Repair confirmed refunds":"Виправити підтверджені refund-и")+' ('+Number(s.repairable_count||0)+')</button>'
    :"";
  const okState=!issues.length;
  root.classList.add("financeDeepRecon");
  root.innerHTML=
    '<div class="financeDeepHead"><div><b>'+(currentLang==="en"?"Deep reconciliation":"Глибока звірка")+'</b>'+
    '<span>'+scope+'</span></div>'+
    '<div class="financeDeepState '+(okState?"ok":"warn")+'">'+
    (okState?(currentLang==="en"?"✓ No discrepancies":"✓ Розбіжностей немає"):(currentLang==="en"?"Needs review":"Потрібна перевірка"))+
    '</div></div>'+
    '<div class="financeDeepMetrics">'+
      '<div><strong>'+Number(scan.telegram_transactions_fetched||0)+'</strong><span>Telegram tx</span></div>'+
      '<div><strong>'+Number(s.checked_orders||0)+'</strong><span>'+(currentLang==="en"?"Checked":"Перевірено")+'</span></div>'+
      '<div><strong>'+Number(s.critical_count||0)+'</strong><span>'+(currentLang==="en"?"Critical":"Критичних")+'</span></div>'+
      '<div><strong>'+Number(s.high_count||0)+'</strong><span>'+(currentLang==="en"?"High":"Важливих")+'</span></div>'+
    '</div>'+
    (repairBtn?'<div class="financeDeepActions">'+repairBtn+'</div>':'')+
    '<div class="financeDeepIssues">'+issueHtml+'</div>';
  const repair=$("financeRepairBtn");
  if(repair)repair.onclick=async()=>{
    const ok=await confirmAction(currentLang==="en"
      ?"Repair only refunds that Telegram already confirms as completed?"
      :"Виправити лише ті refund-и, які Telegram уже підтверджує як виконані?");
    if(!ok)return;
    repair.disabled=true;
    repair.textContent=currentLang==="en"?"Repairing…":"Виправляємо…";
    const fixed=await secureApi("admin_finance_reconcile",{repair_refunds:true,confirmation:"RECONCILE_REFUNDS"});
    renderFinanceDeepReconciliation(fixed);
    if(fixed?.repaired_order_ids?.length){
      tg?.HapticFeedback?.notificationOccurred("success");
      await openAdminFinance();
    }
  };
}

async function runFinanceDeepReconciliation(){
  const root=$("financeDeepRecon");
  if(root)root.innerHTML='<b>'+(currentLang==="en"?"Deep reconciliation":"Глибока звірка")+'</b><span>'+(currentLang==="en"?"Checking Telegram…":"Перевіряємо Telegram…")+'</span>';
  const r=await secureApi("admin_finance_reconcile");
  renderFinanceDeepReconciliation(r);
}

async function getFinanceCsv(){
  const r=await secureApi("admin_finance_export");
  if(!r.ok||!r.csv){showAlert("Не вдалося експортувати дані.");return null}
  return r;
}
async function copyFinanceCsv(){
  const r=await getFinanceCsv();if(!r)return;
  try{
    await navigator.clipboard.writeText(r.csv);
    showAlert("CSV скопійовано ✅");
  }catch{
    const ta=document.createElement("textarea");
    ta.value=r.csv;ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.select();
    const ok=document.execCommand?.("copy");
    ta.remove();
    showAlert(ok?"CSV скопійовано ✅":"Не вдалося експортувати дані.");
  }
}
async function downloadFinanceCsv(){
  const r=await getFinanceCsv();if(!r)return;
  try{
    const blob=new Blob([r.csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=r.filename||"vybe-stars.csv";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch{
    await copyFinanceCsv();
  }
}
async function openAdminFinance(){
  if(!adminRole){showAlert("Admin access required");return}
  setSheetFullscreen(true);
  content.innerHTML='<h2>'+uiText("Фінанси VYBE ⭐")+'</h2><div class="empty">'+uiText("Завантаження…")+'</div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const r=await secureApi("admin_finance_summary");
  if(!r.ok){content.innerHTML='<h2>'+uiText("Фінанси VYBE ⭐")+'</h2><div class="empty">'+escapeHtml(r.error||"Error")+'</div>';return}

  const bal=r.telegram_balance||{};
  const sales=r.sales||{};
  const rec=r.reconciliation||{};
  const orders=r.recent_orders||[];
  const attempts=r.recent_attempts||[];
  const txs=r.telegram_transactions||[];
  const status=r.order_status_counts||{};
  const products=r.product_breakdown||[];
  const refunds=r.refund_history||[];
  const withdrawal=r.withdrawal||{};
  const orderHtml=orders.length?orders.map((o,i)=>{
    const title=adminOrderTitle(o);
    const refund=o.status==="paid"&&r.admin_role==="owner"?'<button class="choice adminRefundBtn" data-index="'+i+'">'+uiText("Повернути Stars")+'</button>':"";
    return '<div class="adminOrder"><div class="adminOrderMain"><b>'+escapeHtml(title)+'</b><small>⭐ '+Number(o.stars||0)+' • '+escapeHtml(adminStatusLabel(o.status))+' • '+escapeHtml(adminDate(o.paid_at||o.created_at))+'</small></div>'+refund+'</div>';
  }).join(""):'<div class="empty">'+uiText("Немає покупок.")+'</div>';
  const productHtml=products.length?products.map(p=>'<div class="adminProduct"><div><b>'+escapeHtml(currentLang==="en"?(p.title_en||p.product_key):(p.title_uk||p.product_key))+'</b><small>'+uiText("Спроб")+': '+Number(p.attempts||0)+' • '+uiText("Оплачені")+': '+Number(p.paid_orders||0)+' • '+uiText("Повернення")+': '+Number(p.refund_orders||0)+'</small></div><div class="adminProductStars"><strong>⭐ '+Number(p.net_stars||0)+'</strong><small>'+uiText("Валові")+': '+Number(p.gross_stars||0)+'</small></div></div>').join(""):'<div class="empty">—</div>';
  const attemptHtml=attempts.length?attempts.map(o=>'<div class="adminAttempt"><b>'+escapeHtml(adminOrderTitle(o))+'</b><small>⭐ '+Number(o.stars||0)+' • '+escapeHtml(adminStatusLabel(o.status))+' • '+escapeHtml(adminDate(o.created_at))+'</small></div>').join(""):'<div class="empty">—</div>';
  const refundHtml=refunds.length?refunds.map(o=>{
    const source=o.source==="owner"?uiText("Власник"):uiText("Автоматично");
    return '<div class="adminRefundHistory"><div><b>'+escapeHtml(adminOrderTitle(o))+'</b><small>'+escapeHtml(source)+' • '+escapeHtml(adminDate(o.refunded_at||o.audit_created_at))+'</small></div><strong>−'+Number(o.stars||0)+' ⭐</strong></div>';
  }).join(""):'<div class="empty">—</div>';


  const txHtml=txs.length?txs.slice(0,20).map(tx=>{
    const signed=Number(tx.signed_amount??tx.amount??0);
    const sign=signed>0?"+":"";
    const when=tx.date?new Date(Number(tx.date)*1000).toLocaleString(uiLocale(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
    let label=tx.direction==="incoming"?uiText("Вхідна транзакція"):tx.direction==="outgoing"?uiText("Вихідна транзакція"):"Telegram";
    if(tx.partner_type==="user"&&tx.direction==="incoming")label=uiText("Оплата користувача");
    if(tx.partner_type==="user"&&tx.direction==="outgoing")label=uiText("Повернення користувачу");
    return '<div class="adminTx '+(signed<0?"outgoing":"incoming")+'"><b>'+sign+signed+' ⭐</b><small>'+escapeHtml(label)+' • '+escapeHtml(when)+'</small></div>';
  }).join(""):'<div class="empty">'+uiText("Немає транзакцій.")+'</div>';

  content.innerHTML='<div class="adminHead"><div><h2>'+uiText("Фінанси VYBE ⭐")+'</h2><small>'+escapeHtml(String(r.admin_role||adminRole))+'</small></div><button id="adminRefreshBtn" class="choice">'+uiText("Оновити")+'</button></div>'+
    '<div class="adminBalance"><small>'+uiText("Баланс бота")+'</small><strong>⭐ '+Number(bal.amount||0)+'</strong><span>'+uiText("Джерело істини для поточного балансу — Telegram.")+'</span></div>'+
    '<div class="adminMetrics">'+adminMetricCard("24 години",sales.today)+adminMetricCard("7 днів",sales.days_7)+adminMetricCard("30 днів",sales.days_30)+adminMetricCard("Весь час",sales.all_time)+'</div>'+
    '<div class="adminRecon"><b>'+uiText("Звірка Telegram ↔ VYBE")+'</b><span>'+uiText("Збігів")+': '+Number(rec.matched_orders||0)+' '+uiText("з")+' '+Number(rec.checked_orders||0)+'</span></div>'+
    (r.admin_role==="owner"?'<div id="financeDeepRecon" class="adminRecon financeDeepRecon financeDeepLaunch"><div><b>'+(currentLang==="en"?"Deep reconciliation":"Глибока звірка")+'</b><span>'+(currentLang==="en"?"Owner-only scan up to 1000 Telegram transactions":"Owner-only scan до 1000 Telegram transactions")+'</span></div><button id="financeReconcileBtn" class="choice">'+(currentLang==="en"?"Deep check":"Глибока перевірка")+'</button></div>':"")+
    '<h3>'+uiText("Продажі за продуктами")+'</h3><div class="adminProducts">'+productHtml+'</div>'+
    '<h3>'+uiText("Статуси замовлень")+'</h3><div class="adminStatusGrid"><div><b>'+Number(status.paid||0)+'</b><span>'+uiText("Успішних")+'</span></div><div><b>'+Number(status.refunded||0)+'</b><span>'+uiText("Повернення")+'</span></div><div><b>'+Number(status.pending||0)+'</b><span>'+uiText("Відкритих")+'</span></div><div><b>'+Number(status.failed||0)+'</b><span>'+uiText("Помилок")+'</span></div><div><b>'+Number(status.expired||0)+'</b><span>'+uiText("Прострочених")+'</span></div><div><b>'+Number(status.cancelled||0)+'</b><span>'+uiText("Скасованих")+'</span></div></div>'+
    '<div class="adminWithdraw"><div><b>'+uiText("Виведення Stars")+'</b><span>'+uiText("Виведення виконується власником через Telegram / Fragment. VYBE не зберігає 2FA і не запускає виведення від імені бота.")+'</span></div><button id="withdrawHelpBtn" class="choice">'+uiText("Як вивести")+'</button></div>'+
    '<div class="adminExport"><div><b>'+uiText("Експорт продажів")+'</b><span>CSV • '+Number((status.paid||0)+(status.refunded||0)+(status.failed||0)+(status.expired||0)+(status.cancelled||0)+(status.pending||0))+' '+uiText("Спроб").toLowerCase()+'</span></div><div><button id="downloadCsvBtn" class="choice">'+uiText("Завантажити CSV")+'</button><button id="copyCsvBtn" class="choice">'+uiText("Скопіювати CSV")+'</button></div></div>'+
    '<h3>'+uiText("Історія повернень")+'</h3><div class="adminRefundHistoryList">'+refundHtml+'</div>'+
    '<h3>'+uiText("Останні замовлення")+'</h3><div class="adminOrders">'+orderHtml+'</div>'+
    '<details class="adminAttempts"><summary>'+uiText("Технічні спроби")+' ('+attempts.length+')</summary><div class="adminAttemptList">'+attemptHtml+'</div></details>'+
    '<h3>'+uiText("Останні транзакції Telegram")+'</h3><div class="adminTransactions">'+txHtml+'</div>';

  $("adminRefreshBtn").onclick=openAdminFinance;
  const financeReconcileBtn=$("financeReconcileBtn");if(financeReconcileBtn)financeReconcileBtn.onclick=runFinanceDeepReconciliation;
  const withdrawHelp=$("withdrawHelpBtn");if(withdrawHelp)withdrawHelp.onclick=()=>{const url="https://core.telegram.org/api/stars#withdrawal";if(tg?.openLink)tg.openLink(url);else window.open(url,"_blank","noopener,noreferrer")};
  const downloadCsv=$("downloadCsvBtn");if(downloadCsv)downloadCsv.onclick=downloadFinanceCsv;
  const copyCsv=$("copyCsvBtn");if(copyCsv)copyCsv.onclick=copyFinanceCsv;
  content.querySelectorAll(".adminRefundBtn").forEach(btn=>btn.onclick=()=>{
    const o=orders[Number(btn.dataset.index)];if(o)adminRefundOrder(o.id,o.stars,adminOrderTitle(o));
  });
  requestAnimationFrame(()=>{const card=sheet.querySelector(".sheetCard");if(card)card.scrollTop=0});
}

function adminSupportTicketTitle(t){
  const name=t.user?.name||"VYBE";
  const category=t.category==="payment"?uiText("Проблема з оплатою"):uiText("Загальне питання");
  return name+" • "+category;
}
async function updateAdminSupport(ticketId,status,replyText="",adminNote=""){
  const operationId=crypto.randomUUID?.()||String(Date.now())+"-"+Math.random().toString(36).slice(2);
  const r=await secureApi("admin_support_update",{ticket_id:ticketId,status,reply_text:replyText,admin_note:adminNote,operation_id:operationId});
  if(!r.ok){
    showAlert(r.status===409?"Відповідь уже обробляється. Онови звернення.":"Не вдалося оновити звернення.");
    return false
  }
  analyticsCapture("admin_support_updated",{status,replied:!!replyText,duplicate_prevented:r.duplicate_prevented===true});
  await loadSupportCounts();
  tg?.HapticFeedback?.notificationOccurred("success");
  showAlert("Статус оновлено ✅");
  return true;
}
async function loadAdminSupportData(){
  if(!adminRole)return {ok:false,error:"Admin access required"};
  return secureApi("admin_support_list");
}
async function openAdminSupportTicket(ticket,draft={}){
  await secureApi("admin_support_mark_seen",{ticket_id:ticket.id});
  await loadSupportCounts();
  const order=ticket.latest_order;
  const noteDraft=String(draft.note??ticket.admin_note??"");
  const replyDraft=String(draft.reply??"");
  content.innerHTML='<div class="adminHead"><div><h2>'+uiText("Центр підтримки")+'</h2><small>'+escapeHtml(adminSupportTicketTitle(ticket))+'</small></div><button id="backToSupportQueue" class="choice">←</button></div><div class="supportTicketDetail"><div class="myTicketHead"><b>'+escapeHtml(ticket.user?.name||"VYBE")+'</b><span class="supportStatus '+escapeHtml(ticket.status)+'">'+escapeHtml(supportStatusLabel(ticket.status))+'</span></div>'+(ticket.user?.username?'<small>@'+escapeHtml(ticket.user.username)+'</small>':'')+'<p>'+escapeHtml(ticket.message)+'</p><small>'+escapeHtml(adminDate(ticket.created_at))+'</small></div>'+(order?'<div class="supportOrder"><b>'+uiText("Остання покупка")+'</b><span>'+escapeHtml(order.product_key)+' • ⭐ '+Number(order.stars||0)+' • '+escapeHtml(adminStatusLabel(order.status))+'</span></div>':'')+'<label>'+uiText("Внутрішня нотатка")+'<textarea id="supportAdminNote" class="field supportMessage" maxlength="1000">'+escapeHtml(noteDraft)+'</textarea></label><label>'+uiText("Відповідь користувачу")+'<textarea id="supportReplyText" class="field supportMessage" maxlength="1500" placeholder="'+uiText("Відповідь користувачу")+'">'+escapeHtml(replyDraft)+'</textarea></label><p class="safetyHint">'+uiText("«Взяти в роботу» змінює лише статус і не надсилає текст користувачу.")+' '+uiText("Відповідь не буде втрачена.")+'</p><div class="supportAdminActions">'+(ticket.status!=="reviewed"?'<button id="markReviewedBtn" class="choice">'+uiText("Взяти в роботу")+'</button>':'')+'<button id="replyResolveBtn" class="primary">'+uiText("Відповісти й закрити")+'</button><button id="resolveNoReplyBtn" class="choice">'+uiText("Закрити без відповіді")+'</button>'+(ticket.status==="resolved"?'<button id="reopenTicketBtn" class="choice">'+uiText("Повернути у відкриті")+'</button>':'')+'</div>';
  $("backToSupportQueue").onclick=()=>openAdminSupport();
  const note=()=>$("supportAdminNote")?.value?.trim()||"";
  const reply=()=>$("supportReplyText")?.value?.trim()||"";
  const replyBtn=$("replyResolveBtn");
  const syncReplyButton=()=>{if(replyBtn)replyBtn.disabled=reply().length<2};
  $("supportReplyText")?.addEventListener("input",syncReplyButton);
  syncReplyButton();

  const reviewed=$("markReviewedBtn");
  if(reviewed)reviewed.onclick=async()=>{
    const keep={note:note(),reply:reply()};
    if(await updateAdminSupport(ticket.id,"reviewed","",keep.note)){
      await openAdminSupport(ticket.id,keep);
    }
  };
  if(replyBtn)replyBtn.onclick=async()=>{
    const text=reply();if(text.length<2){showAlert("Відповідь користувачу");return}
    replyBtn.disabled=true;
    const ok=await updateAdminSupport(ticket.id,"resolved",text,note());
    if(ok)await openAdminSupport();
    else{replyBtn.disabled=false;syncReplyButton()}
  };
  const resolveNoReply=$("resolveNoReplyBtn");
  resolveNoReply.onclick=async()=>{resolveNoReply.disabled=true;const ok=await updateAdminSupport(ticket.id,"resolved","",note());if(ok)await openAdminSupport();else resolveNoReply.disabled=false};
  const reopen=$("reopenTicketBtn");if(reopen)reopen.onclick=async()=>{if(await updateAdminSupport(ticket.id,"open","",note()))await openAdminSupport(ticket.id,{note:note(),reply:reply()})};
}
async function openAdminSupport(ticketId=null,draft=null){
  if(!adminRole){showAlert("Admin access required");return}
  content.innerHTML='<h2>'+uiText("Центр підтримки")+'</h2><div class="empty">'+uiText("Завантаження…")+'</div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const r=await loadAdminSupportData();
  if(!r.ok){content.innerHTML='<h2>'+uiText("Центр підтримки")+'</h2><div class="empty">'+escapeHtml(r.error||"Error")+'</div>';return}
  const c=r.counts||{};
  const tickets=(r.tickets||[]).sort((a,b)=>{
    const rank={open:0,reviewed:1,resolved:2};
    return (rank[a.status]??9)-(rank[b.status]??9)||new Date(b.created_at)-new Date(a.created_at);
  });
  if(ticketId){
    const target=tickets.find(t=>String(t.id)===String(ticketId));
    if(target){await openAdminSupportTicket(target,draft||{});return}
  }
  const rows=tickets.length?tickets.map((t,i)=>'<button class="supportQueueItem '+(!t.admin_seen_at&&(t.status==="open"||t.status==="reviewed")?"unread":"")+'" data-index="'+i+'"><div class="myTicketHead"><b>'+escapeHtml(t.user?.name||"VYBE")+(!t.admin_seen_at&&(t.status==="open"||t.status==="reviewed")?' <span class="ticketUnread">●</span>':'')+'</b><span class="supportStatus '+escapeHtml(t.status)+'">'+escapeHtml(supportStatusLabel(t.status))+'</span></div><p>'+escapeHtml(t.message)+'</p><small>'+escapeHtml(t.category==="payment"?uiText("Проблема з оплатою"):uiText("Загальне питання"))+' • '+escapeHtml(adminDate(t.created_at))+'</small></button>').join(""):'<div class="empty">'+uiText("Черга порожня.")+'</div>';
  content.innerHTML='<div class="adminHead"><div><h2>'+uiText("Центр підтримки")+'</h2><small>'+escapeHtml(String(r.admin_role||adminRole))+'</small></div><button id="supportRefreshBtn" class="choice">'+uiText("Оновити")+'</button></div><div class="supportStats"><div><b>'+Number(c.open||0)+'</b><span>'+uiText("Відкриті")+'</span></div><div><b>'+Number(c.reviewed||0)+'</b><span>'+uiText("В роботі")+'</span></div><div><b>'+Number(c.resolved||0)+'</b><span>'+uiText("Вирішені")+'</span></div><div><b>'+Number(c.payment||0)+'</b><span>'+uiText("Платіжні")+'</span></div><div><b>'+Number(c.general||0)+'</b><span>'+uiText("Загальні")+'</span></div></div><div class="supportQueue">'+rows+'</div>';
  $("supportRefreshBtn").onclick=()=>openAdminSupport();
  content.querySelectorAll(".supportQueueItem").forEach(btn=>btn.onclick=()=>{const t=tickets[Number(btn.dataset.index)];if(t)openAdminSupportTicket(t)});
  requestAnimationFrame(()=>{const card=sheet.querySelector(".sheetCard");if(card)card.scrollTop=0});
}

async function updateAdminModeration(reportId,status,adminNote=""){
  const r=await secureApi("admin_moderation_update",{report_id:reportId,status,admin_note:adminNote});
  if(!r.ok){showAlert("Не вдалося оновити модерацію.");return false}
  await loadSupportCounts();
  tg?.HapticFeedback?.notificationOccurred("success");
  showAlert("Модераційний статус оновлено ✅");
  return true;
}
async function restrictModerationUser(report,mode){
  if(adminRole!=="owner")return false;
  const restore=mode==="restore";
  const message=restore?uiText("Відновити доступ цього користувача до VYBE?"):uiText("Обмежити цього користувача у VYBE? Він зникне з пошуку, збігів і не зможе писати повідомлення.");
  if(!await confirmAction(message))return false;
  const r=await secureApi("admin_moderation_restrict",{
    report_id:report.id,
    target_user_id:report.reported?.id||report.reported_id,
    mode:restore?"restore":"restrict",
    confirmation:restore?"RESTORE":"RESTRICT",
    reason:report.reason,
  });
  if(!r.ok){showAlert("Не вдалося оновити модерацію.");return false}
  await loadSupportCounts();
  tg?.HapticFeedback?.notificationOccurred("success");
  showAlert(restore?"Доступ відновлено ✅":"Доступ обмежено ✅");
  return true;
}
async function loadAdminModerationData(){
  if(!adminRole)return {ok:false,error:"Admin access required"};
  return secureApi("admin_moderation_list");
}
async function openAdminModerationReport(report){
  await secureApi("admin_moderation_mark_seen",{report_id:report.id});
  await loadSupportCounts();
  const reported=report.reported||{}, reporter=report.reporter||{};
  const restricted=reported.account_status==="restricted";
  content.innerHTML='<div class="adminHead"><div><h2>'+uiText("Модерація VYBE 🛡")+'</h2><small>'+escapeHtml(moderationReasonLabel(report.reason))+'</small></div><button id="backToModerationQueue" class="choice">←</button></div>'+
    '<div class="moderationCase '+((report.reason==="underage"||report.reason==="illegal_content")?"urgent":"")+'"><div class="myTicketHead"><b>'+uiText("Користувач зі скарги")+'</b><span class="supportStatus '+escapeHtml(report.status)+'">'+escapeHtml(moderationStatusLabel(report.status))+'</span></div><div class="moderationPerson"><b>'+escapeHtml(reported.name||"VYBE")+(reported.age?", "+escapeHtml(reported.age):"")+'</b>'+(reported.username?'<small>@'+escapeHtml(reported.username)+'</small>':'')+'<small>'+escapeHtml(reported.city||"")+'</small><span class="accountState '+(restricted?"restricted":"active")+'">'+uiText(restricted?"Акаунт обмежено":"Активний акаунт")+'</span></div><hr><b>'+uiText("Причина")+': '+escapeHtml(moderationReasonLabel(report.reason))+'</b>'+(report.details?'<p>'+escapeHtml(report.details)+'</p>':'')+(report.block_requested?'<div class="reporterBlockFlag">🚫 Скаржник також обрав блокування</div>':'')+'<small>'+escapeHtml(adminDate(report.created_at))+'</small></div>'+
    '<div class="moderationReporter"><b>'+uiText("Скаржник")+'</b><span>'+escapeHtml(reporter.name||"VYBE")+(reporter.username?" • @"+escapeHtml(reporter.username):"")+'</span></div>'+
    '<label>'+uiText("Внутрішня нотатка")+'<textarea id="moderationAdminNote" class="field supportMessage" maxlength="1000">'+escapeHtml(report.admin_note||"")+'</textarea></label>'+
    '<div class="supportAdminActions">'+(report.status!=="reviewed"?'<button id="moderationReviewedBtn" class="choice">'+uiText("Взяти в роботу")+'</button>':'')+'<button id="moderationResolvedBtn" class="primary">'+uiText("Позначити вирішеною")+'</button><button id="moderationDismissBtn" class="choice">'+uiText("Відхилити скаргу")+'</button>'+(adminRole==="owner"?'<button id="moderationRestrictionBtn" class="choice moderationDanger">'+uiText(restricted?"Відновити акаунт":"Обмежити акаунт")+'</button>':'')+'</div>';
  $("backToModerationQueue").onclick=()=>openAdminModeration();
  const note=()=>$("moderationAdminNote")?.value?.trim()||"";
  const reviewed=$("moderationReviewedBtn");if(reviewed)reviewed.onclick=async()=>{if(await updateAdminModeration(report.id,"reviewed",note()))await openAdminModeration(report.id)};
  $("moderationResolvedBtn").onclick=async()=>{if(await updateAdminModeration(report.id,"resolved",note()))await openAdminModeration()};
  $("moderationDismissBtn").onclick=async()=>{if(await updateAdminModeration(report.id,"dismissed",note()))await openAdminModeration()};
  const restriction=$("moderationRestrictionBtn");if(restriction)restriction.onclick=async()=>{if(await restrictModerationUser(report,restricted?"restore":"restrict"))await openAdminModeration(report.id)};
}
async function openAdminModeration(reportId=null){
  if(!adminRole){showAlert("Admin access required");return}
  content.innerHTML='<h2>'+uiText("Модерація VYBE 🛡")+'</h2><div class="empty">'+uiText("Завантаження…")+'</div>';
  sheet.classList.remove("hidden");tg?.BackButton?.show?.();
  const r=await loadAdminModerationData();
  if(!r.ok){content.innerHTML='<h2>'+uiText("Модерація VYBE 🛡")+'</h2><div class="empty">'+escapeHtml(r.error||"Error")+'</div>';return}
  const c=r.counts||{};
  const reports=(r.reports||[]).sort((a,b)=>{
    const urgent=x=>x.reason==="underage"||x.reason==="illegal_content"?0:1;
    const rank={open:0,reviewed:1,resolved:2,dismissed:3};
    return urgent(a)-urgent(b)||(rank[a.status]??9)-(rank[b.status]??9)||new Date(b.created_at)-new Date(a.created_at);
  });
  if(reportId){
    const target=reports.find(x=>String(x.id)===String(reportId));
    if(target){await openAdminModerationReport(target);return}
  }
  const rows=reports.length?reports.map((rpt,i)=>{
    const urgent=rpt.reason==="underage"||rpt.reason==="illegal_content";
    const unseen=!rpt.admin_seen_at&&(rpt.status==="open"||rpt.status==="reviewed");
    return '<button class="supportQueueItem moderationQueueItem '+(urgent?"urgent ":"")+(unseen?"unread":"")+'" data-index="'+i+'"><div class="myTicketHead"><b>'+escapeHtml(rpt.reported?.name||"VYBE")+(unseen?' <span class="ticketUnread">●</span>':'')+'</b><span class="supportStatus '+escapeHtml(rpt.status)+'">'+escapeHtml(moderationStatusLabel(rpt.status))+'</span></div><p>'+escapeHtml(moderationReasonLabel(rpt.reason))+'</p><small>'+escapeHtml(adminDate(rpt.created_at))+(urgent?" • 🚨":"")+'</small></button>';
  }).join(""):'<div class="empty">'+uiText("Черга порожня.")+'</div>';
  content.innerHTML='<div class="adminHead"><div><h2>'+uiText("Модерація VYBE 🛡")+'</h2><small>'+escapeHtml(String(r.admin_role||adminRole))+'</small></div><button id="moderationRefreshBtn" class="choice">'+uiText("Оновити")+'</button></div><div class="supportStats moderationStats"><div><b>'+Number(c.open||0)+'</b><span>'+uiText("Відкриті")+'</span></div><div><b>'+Number(c.reviewed||0)+'</b><span>'+uiText("В роботі")+'</span></div><div><b>'+Number(c.resolved||0)+'</b><span>'+uiText("Вирішені")+'</span></div><div><b>'+Number(c.dismissed||0)+'</b><span>'+uiText("Відхилено")+'</span></div><div><b>'+Number((c.underage||0)+(c.illegal_content||0))+'</b><span>🚨</span></div></div><div class="supportQueue">'+rows+'</div>';
  $("moderationRefreshBtn").onclick=()=>openAdminModeration();
  content.querySelectorAll(".moderationQueueItem").forEach(btn=>btn.onclick=()=>{const x=reports[Number(btn.dataset.index)];if(x)openAdminModerationReport(x)});
  requestAnimationFrame(()=>{const card=sheet.querySelector(".sheetCard");if(card)card.scrollTop=0});
}

function openSettings(){
  const ownerTestTools=adminRole==="owner"
    ? '<p class="settingsLabel">'+uiText("Beta test tools")+'</p><button id="ownerResetTestMatchBtn" class="choice safetyChoice testResetChoice">'+uiText("🧪 Скинути тестовий match")+'</button><p class="safetyHint">'+uiText("Тимчасово: видаляє лише один owner-test match, взаємні лайки, чат і пов’язані сповіщення.")+'</p>'
    : "";
  content.innerHTML='<h2>'+uiText("Налаштування ⚙")+'</h2><p class="settingsLabel">'+uiText("Мова")+'</p><div class="languageGrid"><button id="langUkBtn" class="choice '+(currentLang==="uk"?"selected":"")+'">🇺🇦 Українська</button><button id="langEnBtn" class="choice '+(currentLang==="en"?"selected":"")+'">🇬🇧 English</button></div><p class="settingsLabel">'+uiText("Telegram-сповіщення")+'</p><div class="notificationSettings">'+notificationToggleMarkup("notifLikesBtn","Лайки","likes","💜")+notificationToggleMarkup("notifMatchesBtn","Збіги","matches","✨")+notificationToggleMarkup("notifMessagesBtn","Повідомлення","messages","💬")+'</div><p class="safetyHint">'+uiText("Сповіщення не містять текстів приватних повідомлень.")+'</p><p class="settingsLabel">'+uiText("Аналітика продукту")+'</p><button id="analyticsToggleBtn" class="choice safetyChoice">'+uiText("Аналітика продукту")+': <b>'+uiText(analyticsEnabled?"Увімкнено":"Вимкнено")+'</b></button><p class="safetyHint">'+uiText("Допомагає покращувати VYBE. Без текстів чатів, bio, імен чи міста.")+'</p><button id="privacyInfoBtn" class="choice safetyChoice">'+uiText("🔐 Приватність")+'</button><button id="communityRulesBtn" class="choice safetyChoice">'+uiText("🛡 Правила спільноти")+'</button><button id="termsBtn" class="choice safetyChoice">'+uiText("📄 Умови користування")+'</button><button id="settingsBlockedBtn" class="choice safetyChoice">'+uiText("🚫 Заблоковані користувачі")+'</button>'+ownerTestTools+(adminRole?'<p class="safetyHint">'+(currentLang==="en"?"Admin/owner accounts must remove their admin role before account deletion.":"Admin/owner акаунт спочатку має передати або зняти адміністративну роль.")+'</p>':'<button id="deleteAccountBtn" class="choice safetyChoice dangerChoice">'+uiText("🗑 Видалити акаунт")+'</button>');
  sheet.classList.remove("hidden");
  $("langUkBtn").onclick=()=>setLanguage("uk");
  $("langEnBtn").onclick=()=>setLanguage("en");
  $("notifLikesBtn").onclick=()=>toggleNotificationPreference("likes");
  $("notifMatchesBtn").onclick=()=>toggleNotificationPreference("matches");
  $("notifMessagesBtn").onclick=()=>toggleNotificationPreference("messages");
  $("analyticsToggleBtn").onclick=()=>{
    analyticsEnabled=!analyticsEnabled;
    store("vybeAnalytics",analyticsEnabled);
    if(analyticsEnabled)analyticsCapture("analytics_opt_in");
    openSettings();
  };
  $("privacyInfoBtn").onclick=openPrivacyInfo;
  $("communityRulesBtn").onclick=openCommunityRules;
  $("termsBtn").onclick=()=>openLegalPage("terms.html");
  $("settingsBlockedBtn").onclick=openBlockedUsers;
  const ownerReset=$("ownerResetTestMatchBtn");
  if(ownerReset)ownerReset.onclick=async()=>{
    await loadMatches();
    if(matches.length!==1){showAlert("Для безпечного скидання має бути рівно один match.");return}
    const m=matches[0];
    const ok=await confirmAction("Скинути тестовий match із "+m.name+"? Будуть видалені взаємні лайки, чат і пов’язані тестові сповіщення.");
    if(!ok)return;
    ownerReset.disabled=true;
    const r=await secureApi("admin_test_reset_match",{match_id:m.match_id,confirmation:"RESET_TEST_MATCH"});
    if(!r.ok){ownerReset.disabled=false;showAlert("Не вдалося скинути тестовий match.");return}
    activeChat=null;matches=[];updateUnreadBadge(0);renderMatches();renderChats();
    await Promise.all([loadPeople(),loadMatches(),loadSupportCounts()]);
    analyticsCapture("admin_test_match_reset");
    tg?.HapticFeedback?.notificationOccurred("success");
    sheet.classList.add("hidden");
    showAppNotice(r.blocked_between?"Тестовий match скинуто ✅ • перевір блокування":"Тестовий match скинуто ✅");
  };
  const deleteAccountBtn=$("deleteAccountBtn");if(deleteAccountBtn)deleteAccountBtn.onclick=openDeleteAccount;
}

const ageTermsBtn=document.getElementById("ageTermsBtn"),agePrivacyBtn=document.getElementById("agePrivacyBtn"),ageRulesBtn=document.getElementById("ageRulesBtn");
if(ageTermsBtn)ageTermsBtn.onclick=()=>openLegalPage("terms.html");
if(agePrivacyBtn)agePrivacyBtn.onclick=()=>openLegalPage("privacy.html");
if(ageRulesBtn)ageRulesBtn.onclick=()=>openLegalPage("community.html");
const referralBtn=document.getElementById("referralBtn");if(referralBtn)referralBtn.onclick=openReferral;const blockedUsersBtn=document.getElementById("blockedUsersBtn");if(blockedUsersBtn)blockedUsersBtn.onclick=openBlockedUsers;const supportBtn=document.getElementById("supportBtn");if(supportBtn)supportBtn.onclick=openSupportInfo;
const settingsBtn=document.getElementById("settingsBtn");if(settingsBtn)settingsBtn.onclick=openSettings;
const adminFinanceBtn=document.getElementById("adminFinanceBtn");if(adminFinanceBtn)adminFinanceBtn.onclick=openAdminFinance;
const adminSupportBtn=document.getElementById("adminSupportBtn");if(adminSupportBtn)adminSupportBtn.onclick=openAdminSupport;
const adminModerationBtn=document.getElementById("adminModerationBtn");if(adminModerationBtn)adminModerationBtn.onclick=()=>openAdminModeration();
const photoBtn=document.getElementById("photoBtn"),removePhotoBtn=document.getElementById("removePhotoBtn");
if(photoBtn)photoBtn.onclick=()=>{
  const input=document.createElement("input");
  input.type="file";
  input.accept="image/jpeg,image/png,image/webp";
  input.onchange=async()=>{const file=input.files?.[0];if(file)await uploadProfilePhoto(file)};
  input.click();
};
if(removePhotoBtn)removePhotoBtn.onclick=removeProfilePhoto;

function destroyVibeMap(){
  mapMountToken++;
  mapController?.destroy();mapController=null;
  if(sheet.classList.contains("sheetMap"))sheet.classList.remove("sheetMap");
}
function launchVibeMap(options){
  const token=++mapMountToken;
  void mountVibeMap({...options,onReady:controller=>{if(token===mapMountToken)mapController=controller;else controller.destroy()}}).then(controller=>{if(token!==mapMountToken)controller.destroy()});
}
function pickProfileMapArea(){
  destroyVibeMap();setSheetFullscreen(true);
  content.innerHTML=mapShellMarkup(true);sheet.classList.remove("hidden");sheet.classList.add("sheetMap");tg?.BackButton?.show?.();
  launchVibeMap({picker:true,center:onboardingMapPoint?[onboardingMapPoint.lat,onboardingMapPoint.lng]:mapCityCenter($("obCity").value),onPick:point=>{if(!point)return;onboardingMapPoint=point;$("obMapEnabled").checked=true;updateOnboardingMapStatus();closeSheetView()}});
}
function openPeopleMap(){
  destroyVibeMap();setSheetFullscreen(true);
  content.innerHTML=mapShellMarkup();sheet.classList.remove("hidden");sheet.classList.add("sheetMap");tg?.BackButton?.show?.();
  const ownPoint=profile?.map_enabled?snapMapPoint(Number(profile.map_lat),Number(profile.map_lng)):null;
  launchVibeMap({
    center:mapViewState?.center||(ownPoint?[ownPoint.lat,ownPoint.lng]:mapCityCenter(discoverFilters.city||profile?.city)),zoom:mapViewState?.zoom||11,
    commonOnly:discoverFilters.commonOnly===true,
    loadPeople:bounds=>secureApi("discover_map",{...discoveryRequestPayload(),bounds}),
    onProfile:userId=>{mapViewState=mapController?.view();openPublicProfile(userId,{returnMap:true})},
    onFilter:view=>{mapViewState=view;openDiscoverFilters({returnMap:true})},
    onCommon:enabled=>{if(enabled&&!normalizeInterests(profile?.interests).length){showAlert("Додай інтереси в анкету, щоб шукати спільні.");return false}discoverFilters.commonOnly=enabled;store("vybeDiscoverFilters",discoverFilters);void loadPeople();return enabled},
  });
  analyticsCapture("map_open");
}
$("mapBtn").onclick=openPeopleMap;
const mapLifecycleObserver=new MutationObserver(()=>{
  const active=!sheet.classList.contains("hidden")&&!!content.querySelector(".mapShell");
  if(sheet.classList.contains("sheetMap")!==active)sheet.classList.toggle("sheetMap",active);
  if(!active&&mapController)destroyVibeMap();
});
mapLifecycleObserver.observe(content,{childList:true});
mapLifecycleObserver.observe(sheet,{attributes:true,attributeFilter:["class"]});

chatMedia=window.VybeMedia.create({api:secureApi,escape:escapeHtml,language:()=>currentLang,userId:()=>profile?.user_id,allowed:()=>accountStatus==="active"&&window.__vybeAuth?.ok,chat:()=>activeChat,alert:showAlert,content,refreshChat:async()=>{const c=activeChat;if(c)await openChat(c.matchId,c.name,c.userId,{silent:true,preserveDraft:true,noMatchRefresh:true});loadMatches()}});
