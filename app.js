let mode = 'Diplomat';
let isRec = false;
const tg = window.Telegram.WebApp;
tg.expand();

// Вибір персонажа
function sel(m) {
    mode = m;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    document.getElementById(m).classList.add('active');
}

// Запис голосу (Імітація для UI)
function toggleRec() {
    isRec = !isRec;
    const btn = document.getElementById('recBtn');
    if (isRec) {
        btn.innerHTML = "🛑 Зупинити запис";
        btn.classList.add('active');
    } else {
        btn.innerHTML = "✅ Голос збережено";
        btn.classList.remove('active');
        setTimeout(() => { btn.innerHTML = "🎤 Записати мій голос"; }, 2000);
    }
}

// Основна функція запиту
async function ask() {
    const text = document.getElementById('inp').value;
    const resDiv = document.getElementById('res');
    const btn = document.getElementById('b-gen');

    if(!text.trim()) {
        tg.showAlert("Шефе, введіть текст!");
        return;
    }

    btn.disabled = true;
    resDiv.style.display = "block";
    resDiv.innerHTML = "<i>VIBE аналізує...</i>";

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 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'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {role: "system", content: "Ти " + mode + ". Відповідай українською мовою. Стиль: коротко, влучно, харизматично."},
                    {role: "user", content: text}
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const answer = data.choices[0].message.content;
        
        // Вивід тексту
        resDiv.innerHTML = `<b>${mode.toUpperCase()}:</b><br>${answer}`;

        // Озвучка
        const speech = new SpeechSynthesisUtterance(answer);
        speech.lang = 'uk-UA';
        speech.rate = 1.0;
        window.speechSynthesis.speak(speech);

    } catch (e) {
        resDiv.innerHTML = `⚠️ Помилка: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}
