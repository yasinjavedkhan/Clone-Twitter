
const apiKey = "AIzaSyDBQLt6AKlNQWKKr9PPEhK-34MjZVCziLo";

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }
}

listModels();
