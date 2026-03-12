import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files (to be extracted into separate JSON files later)
const resources = {
  en: {
    translation: {
      "login_title": "Welcome back",
      "login_subtitle": "Align your will. Design your intent.",
      "email": "Email Address",
      "password": "Password",
      "sign_in": "Sign In",
      "sign_up": "Sign up free",
      "no_account": "Don't have an account?",
      "forgot_password": "Forgot password?",
      "force_refresh": "Force Hard Refresh & Clear Cache",
      "mobile_issues": "Having issues on mobile?",
      "community_hub": "Community Hub",
      "everything": "Everything",
      "people": "People",
      "places": "Places",
      "events": "Events",
      "language": "Language"
    }
  },
  it: {
    translation: {
      "login_title": "Bentornato",
      "login_subtitle": "Allinea la tua volontà. Disegna il tuo intento.",
      "email": "Indirizzo Email",
      "password": "Password",
      "sign_in": "Accedi",
      "sign_up": "Registrati gratis",
      "no_account": "Non hai un account?",
      "forgot_password": "Password dimenticata?",
      "force_refresh": "Forza Refresh & Svuota Cache",
      "mobile_issues": "Problemi su mobile?",
      "community_hub": "Hub della Community",
      "everything": "Tutto",
      "people": "Persone",
      "places": "Luoghi",
      "events": "Eventi",
      "language": "Lingua"
    }
  },
  es: {
    translation: {
      "login_title": "Bienvenido de nuevo",
      "login_subtitle": "Alinea tu voluntad. Diseña tu intención.",
      "email": "Correo electrónico",
      "password": "Contraseña",
      "sign_in": "Iniciar sesión",
      "sign_up": "Regístrate gratis",
      "no_account": "¿No tienes una cuenta?",
      "forgot_password": "¿Olvidaste tu contraseña?",
      "force_refresh": "Forzar actualización y borrar caché",
      "mobile_issues": "¿Problemas en el móvil?",
      "community_hub": "Centro de la comunidad",
      "everything": "Todo",
      "people": "Gente",
      "places": "Lugares",
      "events": "Eventos",
      "language": "Idioma"
    }
  },
  fr: {
    translation: {
      "login_title": "Bon retour",
      "login_subtitle": "Alignez votre volonté. Concevez votre intention.",
      "email": "Adresse e-mail",
      "password": "Mot de passe",
      "sign_in": "Se connecter",
      "sign_up": "S'inscrire gratuitement",
      "no_account": "Vous n'avez pas de compte ?",
      "forgot_password": "Mot de passe oublié ?",
      "force_refresh": "Forcer le rafraîchissement et vider le cache",
      "mobile_issues": "Problèmes sur mobile ?",
      "community_hub": "Hub communautaire",
      "everything": "Tout",
      "people": "Personnes",
      "places": "Lieux",
      "events": "Événements",
      "language": "Langue"
    }
  },
  ru: {
    translation: {
      "login_title": "С возвращением",
      "login_subtitle": "Направьте свою волю. Создайте свое намерение.",
      "email": "Электронная почта",
      "password": "Пароль",
      "sign_in": "Войти",
      "sign_up": "Зарегистрироваться бесплатно",
      "no_account": "Нет аккаунта?",
      "forgot_password": "Забыли пароль?",
      "force_refresh": "Принудительно обновить и очистить кэш",
      "mobile_issues": "Проблемы на мобильном?",
      "community_hub": "Центр сообщества",
      "everything": "Все",
      "people": "Люди",
      "places": "Места",
      "events": "События",
      "language": "Язык"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
