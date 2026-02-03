let mode = 'Diplomat';
let isRecording = false;

function sel(m) {
    mode = m;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    document.getElementById(m).classList.add('active');
}

function toggleRec() {
    isRecording = !isRecording;
    const btn = document.getElementById('recBtn');
    btn.innerHTML = isRecording ? "🛑 Зупинити..." : "✅ Голос записано";
    btn.classList.toggle('active', isRecording);
}

async function ask() {
    const text = document.getElementById('inp').value;
    const resDiv = document.getElementById('res');
    const btn = document.getElementById('b-gen');
    if(!text.trim()) return;

    btn.disabled = true;
    resDiv.style.display = "block";
    resDiv.innerHTML = "<i>Аналіз...</i>";

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer REMOVED_GROQ_API_KEY'
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
        resDiv.innerHTML = "Помилка зв'язку.";
    } finally {
        btn.disabled = false;
    }
}
