import { generatePixPayload } from './lib/pixGenerator';

console.log('--- TEST 1: Simple Static QR Code (No TXID) ---');
const payload1 = generatePixPayload({
    pixKey: '12345678900', // CPF
    merchantName: 'Loja Exemplo',
    merchantCity: 'Sao Paulo',
    amount: 10.50
});
console.log(payload1);
// Expect field 62 to contain "0503***"

console.log('\n--- TEST 2: Static QR Code with TXID ---');
const payload2 = generatePixPayload({
    pixKey: '+5511999998888', // Phone
    merchantName: 'Joao Silva',
    merchantCity: 'Rio de Janeiro',
    amount: 100.00,
    transactionId: 'PEDIDO-123'
});
console.log(payload2);
// Expect field 62 to contain "0510PEDIDO123"

console.log('\n--- TEST 3: Sanitization ---');
const payload3 = generatePixPayload({
    pixKey: 'TESTE@EXAMPLE.COM',
    merchantName: 'Águia & Falcão',
    merchantCity: 'São Luís',
    transactionId: 'REF 123'
});
console.log(payload3);
// Expect merchant name AGUIA  FALCAO, City SAO LUIS, TXID REF123

console.log('\n--- TEST 4: No Amount ---');
const payload4 = generatePixPayload({
    pixKey: '12345678000199', // CNPJ
    merchantName: 'Empresa LTDA',
    merchantCity: 'Curitiba'
});
console.log(payload4);
