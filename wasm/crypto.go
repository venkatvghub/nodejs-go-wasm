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

// Extremely simple XOR encryption (NOT SECURE - DEMO ONLY)
// Format: version (1 byte) + plaintext length (4 bytes) + encrypted data
func simpleEncrypt(key, plaintext []byte, version byte) []byte {
	// Basic validation
	if len(key) == 0 || len(plaintext) == 0 {
		fmt.Printf("Invalid input: key length=%d, plaintext length=%d\n", len(key), len(plaintext))
		return nil
	}

	// Calculate output size: version(1) + plaintext length(4) + encrypted data
	outputSize := 1 + 4 + len(plaintext)
	result := make([]byte, outputSize)

	// Set version byte
	result[0] = version

	// Store plaintext length in next 4 bytes (big endian)
	pLen := uint32(len(plaintext))
	result[1] = byte(pLen >> 24)
	result[2] = byte(pLen >> 16)
	result[3] = byte(pLen >> 8)
	result[4] = byte(pLen)

	// Simple XOR encryption with the key
	for i := 0; i < len(plaintext); i++ {
		result[5+i] = plaintext[i] ^ key[i%len(key)]
	}

	fmt.Printf("Encrypted %d bytes to %d bytes output\n", len(plaintext), len(result))
	return result
}

// Simple XOR decryption
func simpleDecrypt(key, data []byte) ([]byte, error) {
	// Basic validation
	if len(key) == 0 || len(data) < 5 {
		return nil, fmt.Errorf("invalid input: key length=%d, data length=%d", len(key), len(data))
	}

	// Extract version
	version := data[0]

	// Extract plaintext length
	pLen := uint32(data[1])<<24 | uint32(data[2])<<16 | uint32(data[3])<<8 | uint32(data[4])

	// Validate length
	if uint32(len(data)-5) < pLen {
		return nil, fmt.Errorf("data too short: expected at least %d bytes, got %d", pLen+5, len(data))
	}

	// Allocate result buffer
	plaintext := make([]byte, pLen)

	// Decrypt using XOR with the key
	for i := uint32(0); i < pLen; i++ {
		plaintext[i] = data[5+i] ^ key[i%uint32(len(key))]
	}

	fmt.Printf("Decrypted data with version %d, length %d bytes\n", version, pLen)
	return plaintext, nil
}

//export Encrypt
func Encrypt(ver uint8, keyPtr *uint8, keyLen uint32, pPtr *uint8, pLen uint32) *uint8 {
	// Get input data
	key := goBytes(keyPtr, keyLen)
	plain := goBytes(pPtr, pLen)

	fmt.Printf("Encrypt: key length=%d, plaintext length=%d\n", len(key), len(plain))

	// Use simple encryption
	encrypted := simpleEncrypt(key, plain, ver)
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

	// Simple decryption
	plain, err := simpleDecrypt(key, cipherData)
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
