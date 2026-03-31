/**
 * WebAuthn Biometric (Fingerprint) Helper
 * 
 * Specifically configured for 'platform' authenticators to avoid Bluetooth prompts.
 * FaceID references have been removed as per requirements.
 */

// Convert a base64 string to a Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Convert a Uint8Array to a base64 string
function uint8ArrayToBase64(array: Uint8Array): string {
    const bytes = Array.from(array);
    const binary = bytes.map(byte => String.fromCharCode(byte)).join('');
    return window.btoa(binary);
}

// Check if biometric authentication is supported
export async function isBiometricsSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    
    // Check if platform authenticator (fingerprint, etc.) is available
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
}

/**
 * Register a new biometric (fingerprint) credential
 */
export async function registerFingerprint(userId: string, username: string) {
    if (!await isBiometricsSupported()) {
        throw new Error("Biometric authentication is not supported on this device.");
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: "Twitter Clone",
            id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
            id: userIdBuffer,
            name: username,
            displayName: username,
        },
        pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: "platform", // ONLY platform (Fingerprint/Local)
            userVerification: "required",
            residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
    };

    const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
        throw new Error("Failed to create credential.");
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey();
    if (!publicKey) {
        throw new Error("Public key not found in credential response.");
    }

    return {
        credentialId: credential.id,
        rawId: uint8ArrayToBase64(new Uint8Array(credential.rawId)),
        publicKey: uint8ArrayToBase64(new Uint8Array(publicKey)),
    };
}

/**
 * Authenticate with a biometric (fingerprint) credential
 */
export async function authenticateFingerprint(credentialId: string) {
    if (!await isBiometricsSupported()) {
        throw new Error("Biometric authentication is not supported on this device.");
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [
            {
                id: base64ToUint8Array(credentialId) as any,
                type: "public-key",
                transports: ["internal"] as AuthenticatorTransport[], // ONLY internal (avoid Bluetooth)
            },
        ],
        userVerification: "required",
        timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;

    if (!assertion) {
        throw new Error("Authentication failed.");
    }

    // In a real production app, you would send this assertion to a server to verify.
    // For this generic platform, we'll return successful verification if the credential object is returned.
    return assertion;
}
