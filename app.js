let mode = 'Diplomat';
const tg = window.Telegram.WebApp;
tg.expand();

function sel(m) {
    mode = m;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    document.getElementById(m).classList.add('active');
}

async function ask() {
    const text = document.getElementById('inp').value;
    const resDiv = document.getElementById('res');
    if(!text.trim()) return;

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
                messages: [{role: "system", content: "Ти " + mode + ". Відповідай коротко."}, {role: "user", content: text}]
            })
        });
        const data = await response.json();
        const answer = data.choices[0].message.content;
        resDiv.innerHTML = "<b>" + mode + ":</b><br>" + answer;

        const speech = new SpeechSynthesisUtterance(answer);
        speech.lang = 'uk-UA';
        window.speechSynthesis.speak(speech);
    } catch (e) {
        resDiv.innerHTML = "⚠️ Помилка зв'язку.";
    }
}
