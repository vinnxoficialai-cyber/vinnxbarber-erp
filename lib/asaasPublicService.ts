// Frontend wrapper for ASAAS Public API operations (client self-service)
// Calls /api/asaas-public with JWT auth (any authenticated user)
// NOTE: Does NOT depend on lib/supabase — accepts token directly
// because PublicSite uses its own Supabase client with separate session

const API_URL = '/api/asaas-public';

// Token provider — set externally by PublicSite
let _tokenProvider: (() => string | null) | null = null;
// Refresh callback — called on 401 to silently refresh token
let _refreshCallback: (() => Promise<boolean>) | null = null;

/**
 * Set the token provider function. Must be called once by the consumer
 * (PublicSite) so the service can retrieve the current access token.
 */
export function setAsaasPublicTokenProvider(provider: () => string | null) {
    _tokenProvider = provider;
}

/**
 * Set the refresh callback. Called when a 401 is received to silently
 * refresh the token before retrying the request.
 */
export function setAsaasPublicRefreshCallback(cb: () => Promise<boolean>) {
    _refreshCallback = cb;
}

async function callApi<T = any>(action: string, data?: any): Promise<T> {
    const token = _tokenProvider?.();
    if (!token) throw new Error('Faça login para continuar.');

    const doFetch = (t: string) => fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ action, data }),
    });

    let res = await doFetch(token);

    // Retry once on 401 with refreshed token
    if (res.status === 401 && _refreshCallback) {
        const ok = await _refreshCallback();
        if (ok) {
            const newToken = _tokenProvider?.();
            if (newToken) res = await doFetch(newToken);
        }
    }

    const json = await res.json();
    if (!res.ok || json.success === false) {
        throw new Error(json.error || `Erro ${res.status}`);
    }
    return json;
}

// ═══ Public API ═══

export interface SubscribeResult {
    success: boolean;
    subscriptionId: string;
    paymentStatus: string;      // CONFIRMED | RECEIVED | PENDING | REFUSED | OVERDUE
    finalStatus: string;        // active | pending_payment | overdue
    cardBrand: string;
    cardLast4: string;
    planName: string;
    planPrice: number;
}

export async function subscribeToPlan(data: {
    planId: string;
    unitId?: string;
    creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    holderInfo: {
        cpfCnpj: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
        email?: string;
    };
}): Promise<SubscribeResult> {
    return callApi('createSubscription', data);
}

export async function getMySubscription(): Promise<any> {
    const result = await callApi('getMySubscription');
    return result.subscription;
}

export async function cancelMySubscription(reason?: string): Promise<{ success: boolean; endDate?: string }> {
    return callApi('cancelMySubscription', { reason });
}

export async function pauseMySubscription(): Promise<{ success: boolean }> {
    return callApi('pauseMySubscription');
}

export async function getMyPaymentHistory(): Promise<any[]> {
    const result = await callApi<{ events: any[] }>('getMyPaymentHistory');
    return result.events || [];
}

export async function updatePaymentMethod(data: {
    creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    holderInfo: {
        cpfCnpj: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
        email?: string;
    };
}): Promise<{ success: boolean; cardBrand: string; cardLast4: string }> {
    return callApi('updatePaymentMethod', data);
}

export async function reactivateSubscription(data: {
    creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    holderInfo: {
        cpfCnpj: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
        email?: string;
    };
}): Promise<SubscribeResult> {
    return callApi('reactivateSubscription', data);
}

export async function changePlan(newPlanId: string): Promise<{
    success: boolean;
    scheduled: boolean;
    scheduledDate: string;
    oldPlanId: string;
    newPlanId: string;
    newPlanName: string;
}> {
    return callApi('changePlan', { newPlanId });
}

export async function cancelPendingPlanChange(): Promise<{ success: boolean }> {
    return callApi('cancelPendingPlanChange');
}

export async function retryPayment(): Promise<{ success: boolean }> {
    return callApi('retryPayment');
}
