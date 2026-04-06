
const apiKey = "AIzaSyDBQLt6AKlNQWKKr9PPEhK-34MjZVCziLo";
const models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];

async function testModel(modelId) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${apiKey}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Hi" }] }]
            }),
        });
        const data = await res.json();
        if (res.ok) {
            console.log(`✅ ${modelId}: Success`);
        } else {
            console.log(`❌ ${modelId}: ${res.status} - ${JSON.stringify(data.error)}`);
        }
    } catch (e) {
        console.log(`❌ ${modelId}: Fetch failed - ${e.message}`);
    }
}

async function run() {
    for (const model of models) {
        await testModel(model);
    }
}

run();
