export function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function proprietorTitle(gender: "male" | "female" | null): string {
  return gender === "female" ? "Proprietress" : "Proprietor";
}
