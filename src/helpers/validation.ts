export function validateInn(inn: string): boolean {
  const innRegex = /^\d{10}(\d{2})?$/;
  return innRegex.test(inn);
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^@[a-zA-Z0-9_]{5,32}$/;
  return usernameRegex.test(username);
}

export function parseInnList(text: string): { valid: string[]; invalid: string[] } {
  const inns = text.trim().split(/\s+/);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const inn of inns) {
    if (validateInn(inn)) {
      valid.push(inn);
    } else {
      invalid.push(inn);
    }
  }

  return { valid, invalid };
}

export function parseUsernameList(text: string): { valid: string[]; invalid: string[] } {
  const usernames = text.trim().split(/\s+/);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const username of usernames) {
    if (validateUsername(username)) {
      valid.push(username);
    } else {
      invalid.push(username);
    }
  }

  return { valid, invalid };
}

export function formatInnList(inns: string[]): string {
  return inns.join(', ');
}

export function formatUsernameList(usernames: string[]): string {
  return usernames.join(', ');
}
