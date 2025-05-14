package main

import (
	"fmt"
	"unsafe"
)

var lastLen uint32

//export wasm_malloc
func wasm_malloc(size uint32) *uint8 {
	buf := make([]byte, size)
	return &buf[0]
}

//export last_len
func last_len() uint32 {
	return lastLen
}

// Convert a pointer and length to a Go byte slice
func goBytes(ptr *uint8, length uint32) []byte {
	if ptr == nil || length == 0 {
		return nil
	}
	data := make([]byte, length)
	for i := uint32(0); i < length; i++ {
		data[i] = *(*byte)(unsafe.Pointer(uintptr(unsafe.Pointer(ptr)) + uintptr(i)))
	}
	return data
}

// Simple implementation of AES-like encryption (NOT PRODUCTION READY - for demo only)
// Format: version (1 byte) + iv (16 bytes) + encrypted data
func customEncrypt(key, plaintext []byte, version byte) []byte {
	// Basic validation
	if len(key) != 32 {
		fmt.Printf("Key must be 32 bytes (received %d bytes)\n", len(key))
		return nil
	}

	// Create a deterministic IV based on key
	iv := make([]byte, 16)
	for i := 0; i < 16; i++ {
		iv[i] = key[i%len(key)] ^ byte(i)
	}

	// Allocate buffer for encrypted data: version (1) + iv (16) + data + padding
	// Add padding to make result multiple of 16 bytes
	paddingLength := 16 - (len(plaintext) % 16)
	if paddingLength == 0 {
		paddingLength = 16
	}

	encryptedLength := len(plaintext) + paddingLength
	result := make([]byte, 1+len(iv)+encryptedLength)

	// Set version
	result[0] = version

	// Set IV
	copy(result[1:], iv)

	// Encrypt data with simple XOR + shifting for demonstration
	// Not secure, but avoids crypto package issues
	for i := 0; i < len(plaintext); i++ {
		// Get key byte, iv byte, and position-dependent value
		keyByte := key[i%len(key)]
		ivByte := iv[i%len(iv)]
		position := byte(i % 256)

		// Combine inputs to create encrypted byte
		encryptedByte := plaintext[i] ^ keyByte ^ ivByte ^ position

		// Shift bits for more scrambling
		encryptedByte = (encryptedByte << 3) | (encryptedByte >> 5)

		// Store encrypted byte
		result[1+len(iv)+i] = encryptedByte
	}

	// Fill padding with pseudorandom values
	for i := 0; i < paddingLength; i++ {
		padPos := len(plaintext) + i
		result[1+len(iv)+padPos] = byte(padPos) ^ key[padPos%len(key)]
	}

	// Final length check
	if len(result) != 1+len(iv)+encryptedLength {
		fmt.Printf("Encryption error: expected length %d, got %d\n", 1+len(iv)+encryptedLength, len(result))
	}

	return result
}

// Simple implementation of AES-like decryption (NOT PRODUCTION READY - for demo only)
func customDecrypt(key, data []byte) ([]byte, error) {
	// Basic validation
	if len(key) != 32 {
		return nil, fmt.Errorf("key must be 32 bytes (received %d bytes)", len(key))
	}

	// Check minimum length: version (1) + iv (16) + at least 16 bytes data
	if len(data) < 33 {
		return nil, fmt.Errorf("data too short for decryption: %d bytes", len(data))
	}

	// Extract version and IV
	version := data[0]
	iv := data[1:17]
	ciphertext := data[17:]

	// Decrypt: remove padding and reverse encryption
	// In AES, the plaintext length is not longer than the ciphertext
	// We'll assume no more than 16 bytes of padding
	maxPlaintextLen := len(ciphertext)
	plaintext := make([]byte, maxPlaintextLen)

	// Perform decryption (reverse of encryption)
	for i := 0; i < maxPlaintextLen; i++ {
		// Skip if we're into the padding
		if i >= maxPlaintextLen {
			break
		}

		// Get key byte, iv byte, and position-dependent value
		keyByte := key[i%len(key)]
		ivByte := iv[i%len(iv)]
		position := byte(i % 256)

		// Get encrypted byte and undo bit shifting
		encryptedByte := ciphertext[i]
		unshiftedByte := (encryptedByte >> 3) | (encryptedByte << 5)

		// Undo XOR operations
		plaintext[i] = unshiftedByte ^ keyByte ^ ivByte ^ position
	}

	// Detect padding - since we're using a debug implementation,
	// we'll just return all bytes and let the caller figure out the length

	fmt.Printf("Decrypted data with version: %d\n", version)
	return plaintext, nil
}

//export Encrypt
func Encrypt(ver uint8, keyPtr *uint8, keyLen uint32, pPtr *uint8, pLen uint32) *uint8 {
	// Get input data
	key := goBytes(keyPtr, keyLen)
	plain := goBytes(pPtr, pLen)

	fmt.Printf("Encrypt: key length=%d, plaintext length=%d\n", len(key), len(plain))

	// Custom encryption to avoid crypto package
	encrypted := customEncrypt(key, plain, ver)
	if encrypted == nil {
		fmt.Println("Encryption failed")
		return nil
	}

	fmt.Printf("Encryption successful: output length=%d bytes\n", len(encrypted))

	// Allocate result memory
	result := make([]byte, len(encrypted))
	copy(result, encrypted)

	// Set length for caller to read
	lastLen = uint32(len(result))

	// Return pointer to result
	return &result[0]
}

//export Decrypt
func Decrypt(keyPtr *uint8, keyLen uint32, encPtr *uint8, encLen uint32) *uint8 {
	// Get input data
	key := goBytes(keyPtr, keyLen)
	cipherData := goBytes(encPtr, encLen)

	fmt.Printf("Decrypt: key length=%d, ciphertext length=%d\n", len(key), len(cipherData))

	// Custom decryption to avoid crypto package
	plain, err := customDecrypt(key, cipherData)
	if err != nil {
		fmt.Printf("Decryption failed: %v\n", err)
		return nil
	}

	fmt.Printf("Decryption successful: plaintext length=%d bytes\n", len(plain))

	// Allocate result memory
	result := make([]byte, len(plain))
	copy(result, plain)

	// Set length for caller to read
	lastLen = uint32(len(result))

	// Return pointer to result
	return &result[0]
}

func main() {}
