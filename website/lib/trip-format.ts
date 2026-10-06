export function tripTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

export function tripDate(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function lkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(value)}`
}
