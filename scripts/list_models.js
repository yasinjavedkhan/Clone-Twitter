
const apiKey = "AIzaSyDBQLt6AKlNQWKKr9PPEhK-34MjZVCziLo"; // From .env.local

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
            console.log("✅ Models available for this key:");
            data.models?.forEach(m => console.log(` - ${m.name}`));
        } else {
            console.log(`❌ List Models failed: ${res.status} - ${data.error?.message || "Error"}`);
        }
    } catch (e) {
        console.log(`❌ List Models Fetch failed - ${e.message}`);
    }
}

listModels();
