const fetch = require('node-fetch');

(async () => {
    try {
        const res = await fetch("http://localhost:3001/api/ai", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: "what is my last post",
                history: [],
                userName: "TestUser",
                userId: "qwe123test"
            })
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text.substring(0, 500));
    } catch(e) {
        console.error(e);
    }
})();
