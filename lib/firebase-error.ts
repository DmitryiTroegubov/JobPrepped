import { FirebaseError } from "firebase/app";

export function toAuthErrorMessage(error: unknown) {
  if (error instanceof Error && !(error instanceof FirebaseError)) {
    return error.message;
  }

  if (!(error instanceof FirebaseError)) {
    return "Неизвестная ошибка. Попробуйте еще раз.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "Email уже зарегистрирован. Попробуйте войти.";
    case "auth/invalid-email":
      return "Некорректный email.";
    case "auth/weak-password":
      return "Слабый пароль. Минимум 6 символов.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный email или пароль.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "Нет доступа к Firestore. Проверьте Firestore Rules.";
    default:
      return `${error.code}: ${error.message}`;
  }
}
