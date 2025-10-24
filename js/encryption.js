// Encryption Module for Finance SaaS Application
// Uses Web Crypto API for browser-based encryption

class EncryptionManager {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    // Generate encryption key from password
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.algorithm, length: this.keyLength },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt text data
    async encrypt(text, password = 'default-finance-key-2025') {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.deriveKey(password, salt);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: this.algorithm, iv: iv },
                key,
                data
            );
            
            // Combine salt + iv + encrypted data
            const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            return this.arrayBufferToBase64(result);
        } catch (error) {
            console.error('Encryption failed:', error);
            return text; // Fallback to unencrypted
        }
    }

    // Decrypt text data
    async decrypt(encryptedData, password = 'default-finance-key-2025') {
        try {
            const data = this.base64ToArrayBuffer(encryptedData);
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const encrypted = data.slice(28);
            const key = await this.deriveKey(password, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: this.algorithm, iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedData; // Return as-is if decryption fails
        }
    }

    // Helper: Convert ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Helper: Convert Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Encrypt object (converts to JSON first)
    async encryptObject(obj, password) {
        const json = JSON.stringify(obj);
        return await this.encrypt(json, password);
    }

    // Decrypt object (parses JSON after decrypt)
    async decryptObject(encryptedData, password) {
        const json = await this.decrypt(encryptedData, password);
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    // Hash function for passwords (one-way)
    async hash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
