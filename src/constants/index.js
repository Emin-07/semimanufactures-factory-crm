export const ROLES = [
  { id: 1, name: "admin",   label: "Директор"  },
  { id: 2, name: "manager", label: "Менеджер"  },
  { id: 3, name: "worker",  label: "Работник"  },
  { id: 4, name: "owner",   label: "Владелец"  },
];
export const JOB_TITLES = ["лепщица","фасовщица","грузчик","курьер","торговый представитель","техничка","завхоз","менеджер цеха","другое"];
export const PAY_TYPES = ["сдельная","фиксированная","смешанная"];
export const STORE_STATUSES = ["active","blocked","blacklist"];
export const STORE_STATUS_LABELS = {active:"Активен",blocked:"Заблокирован",blacklist:"Чёрный список"};
export const ORDER_SOURCES = ["WhatsApp","телефон","вручную","другое"];
export const ATTENDANCE_TYPES = ["приход","уход","опоздание","отсутствие"];
export const ATTENDANCE_TYPE_COLORS = {приход:"success",уход:"info",опоздание:"orange",отсутствие:"danger"};
export const BATCH_STATUSES = ["активна","отгружена","списана","забрали сотрудники"];
export const DEFECT_REASONS = ["нарушение рецептуры","брак материала","производственная ошибка","брак упаковки","другое"];
export const PAYROLL_STATUSES = ["начислено","подтверждено к выплате","удержано","перенесено","причина подтверждена"];

export const CATEGORIES = ["Пельмени","Котлеты","Вареники","Блинчики","Манты","Хинкали","Чебуреки","Голубцы"];
export const UNITS = ["кг","шт","уп"];
export const STATUSES = ["в производстве","готов","снят с производства"];
export const TASK_STATUSES = ["назначено","в работе","завершено","просрочено"];
export const RAW_CATEGORIES = ["Мясо","Тесто","Овощи","Специи","Масло","Молочные","Мука","Прочее"];
export const RAW_UNITS = ["кг","л","шт","г"];
export const NOTIF_TYPES = ["информация","предупреждение","ошибка"];
export const MARK_TYPES = ["приход","уход","опоздание","отсутствие"];
export const PLAN_STATUSES = ["запланирован","в процессе","выполнен","отменён"];
export const ORDER_STATUSES = ["новый","сборка","в производстве","готов","отгружен","отменён"];
export const ORDER_PRIORITIES = ["нормальный","важный","срочный"];
export const BOARD_COLUMNS = [
  {id:"новый",          label:"Новые"},
  {id:"сборка",         label:"Сборка"},
  {id:"в производстве", label:"В производстве"},
  {id:"готов",          label:"Готово"},
];
export const MOVEMENT_TYPES = {production:"Производство",output:"Выпуск (ручной)",sale:"Продажа",order_shipment:"Отгрузка заказа",manual_adjustment:"Коррекция"};
export const DEBT_STATUSES = ["активен","частично погашен","погашен"];
export const CAMERA_SOURCE_TYPES = ["demo","iframe","image","mjpeg","mp4","hls","rtsp"];
export const CAMERA_SOURCE_LABELS = {demo:"Демо (заглушка)",iframe:"iframe / Web UI",image:"JPEG snapshot",mjpeg:"MJPEG поток",mp4:"MP4 видео",hls:"HLS (.m3u8)",rtsp:"RTSP (не поддержан)"};
export const CAMERA_ZONES = ["Цех","Склад","Вход","Офис","Улица","Прочее"];
