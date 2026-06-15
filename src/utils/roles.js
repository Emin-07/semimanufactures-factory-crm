import { APP_BRAND } from "../constants/brand.js";
import { ROLES } from "../constants/index.js";

export function getRole(user) {
  return ROLES.find(r => r.id === user?.roleId);
}

export function isSuperAdmin(user) {
  const r = getRole(user);
  return r?.name === "admin" || r?.name === "owner";
}

export function isManagerLike(user) {
  const r = getRole(user);
  return isSuperAdmin(user) || r?.name === "manager";
}

export function isWorker(user) {
  return getRole(user)?.name === "worker";
}

export function canSeeFinance(user) {
  return !isWorker(user);
}

/** worker sub-profile by jobTitle */
export function getJobProfile(user) {
  if (!isWorker(user)) return isManagerLike(user) ? "manager" : "admin";
  const jt = (user?.jobTitle || "другое").toLowerCase();
  if (jt === "лепщица") return "lepstitsa";
  if (jt === "фасовщица") return "packer";
  if (jt === "курьер") return "courier";
  return "worker";
}

export function roleChipLabel(user) {
  const r = getRole(user);
  return r?.label || "Пользователь";
}

export function pageTitle(page, user) {
  const titles = {
    dashboard: getJobProfile(user) === "packer" ? "Фасовка сегодня"
      : getJobProfile(user) === "courier" ? "Доставка сегодня"
      : getJobProfile(user) === "lepstitsa" ? "Моя смена"
      : isManagerLike(user) && !isSuperAdmin(user) ? "Рабочий контроль"
      : isSuperAdmin(user) ? "Сводка смены"
      : "Главная",
    tasks: "Задания",
    packing: "Фасовка",
    delivery: "Доставка",
    trash: "Корзина",
  };
  return titles[page] || APP_BRAND;
}
