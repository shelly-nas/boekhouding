async function verzoek(pad, opties = {}) {
  const res = await fetch(`/api${pad}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opties,
    body: opties.body ? JSON.stringify(opties.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.fout ?? `Fout ${res.status}`);
  return data;
}

export const api = {
  get: (pad) => verzoek(pad),
  post: (pad, body) => verzoek(pad, { method: 'POST', body }),
  put: (pad, body) => verzoek(pad, { method: 'PUT', body }),
  del: (pad) => verzoek(pad, { method: 'DELETE' }),
};
