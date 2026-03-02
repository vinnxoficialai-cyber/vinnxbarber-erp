import { generatePixPayload } from './lib/pixGenerator';

// Canonical Example from online PIX validation tools
// Payload excluding CRC (last 4 chars)
const rawPayload = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
const expectedCRC = "1D3D";

// Implementation from lib/pixGenerator.ts copied here for direct testing
function crc16CCITT(str: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ polynomial) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }

    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

const calculated = crc16CCITT(rawPayload);
console.log(`Expected: ${expectedCRC}`);
console.log(`Calculated: ${calculated}`);
console.log(`Match: ${calculated === expectedCRC}`);

if (calculated !== expectedCRC) {
    console.error("CRITICAL: CRC calculation is incorrect!");
} else {
    console.log("SUCCESS: CRC algorithm is correct.");
}
