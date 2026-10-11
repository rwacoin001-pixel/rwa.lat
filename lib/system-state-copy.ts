import type { AppLocale } from './i18n'

export type SystemStateCopy = {
  error: { kicker: string; title: string; body: string; safe: string; retry: string; reloading: string; home: string; reference: string }
  notFound: { kicker: string; title: string; body: string; safe: string; home: string; help: string }
}

export const systemStateCopy: Record<AppLocale, SystemStateCopy> = {
  en: {
    error: { kicker: 'Safe recovery', title: 'This page didn’t load', body: 'Something interrupted the page. Try again, or head back home.', safe: 'No order, transfer or account change was submitted.', retry: 'Try again', reloading: 'Loading the latest version…', home: 'Back to home', reference: 'Ref.' },
    notFound: { kicker: 'Page not found', title: 'This page isn’t here', body: 'The link may be outdated, or the page has moved.', safe: 'Your account and assets are unaffected.', home: 'Back to home', help: 'Contact support' },
  },
  'zh-CN': {
    error: { kicker: '安全恢复', title: '页面没有加载出来', body: '页面加载被中断了。可以重试，或先回到首页。', safe: '没有提交任何订单、转账或账户变更。', retry: '重试', reloading: '正在加载最新版本…', home: '回到首页', reference: '编号' },
    notFound: { kicker: '页面不存在', title: '找不到这个页面', body: '链接可能已过期，或页面已经移动。', safe: '你的账户与资产不受影响。', home: '回到首页', help: '联系客服' },
  },
  hi: {
    error: { kicker: 'सुरक्षित पुनर्प्राप्ति', title: 'यह पेज लोड नहीं हुआ', body: 'पेज लोड होने में रुकावट आई। फिर से कोशिश करें या होम पर लौटें।', safe: 'कोई ऑर्डर, ट्रांसफ़र या खाता बदलाव सबमिट नहीं हुआ।', retry: 'फिर कोशिश करें', reloading: 'नवीनतम संस्करण लोड हो रहा है…', home: 'होम पर लौटें', reference: 'संदर्भ' },
    notFound: { kicker: 'पेज नहीं मिला', title: 'यह पेज यहाँ नहीं है', body: 'लिंक पुराना हो सकता है, या पेज कहीं और चला गया है।', safe: 'आपका खाता और संपत्ति प्रभावित नहीं हैं।', home: 'होम पर लौटें', help: 'सहायता से संपर्क करें' },
  },
  es: {
    error: { kicker: 'Recuperación segura', title: 'Esta página no se cargó', body: 'Algo interrumpió la página. Inténtalo de nuevo o vuelve al inicio.', safe: 'No se envió ninguna orden, transferencia ni cambio de cuenta.', retry: 'Reintentar', reloading: 'Cargando la última versión…', home: 'Volver al inicio', reference: 'Ref.' },
    notFound: { kicker: 'Página no encontrada', title: 'Esta página no existe', body: 'El enlace puede estar desactualizado o la página se movió.', safe: 'Tu cuenta y tus activos no se ven afectados.', home: 'Volver al inicio', help: 'Contactar con soporte' },
  },
  ar: {
    error: { kicker: 'استعادة آمنة', title: 'تعذّر تحميل هذه الصفحة', body: 'حدث ما قاطع تحميل الصفحة. أعد المحاولة أو ارجع إلى الرئيسية.', safe: 'لم يُرسَل أي أمر أو تحويل أو تغيير على الحساب.', retry: 'إعادة المحاولة', reloading: 'جارٍ تحميل أحدث إصدار…', home: 'العودة إلى الرئيسية', reference: 'المرجع' },
    notFound: { kicker: 'الصفحة غير موجودة', title: 'هذه الصفحة غير متاحة', body: 'قد يكون الرابط قديمًا، أو نُقلت الصفحة.', safe: 'حسابك وأصولك لم تتأثر.', home: 'العودة إلى الرئيسية', help: 'تواصل مع الدعم' },
  },
  fr: {
    error: { kicker: 'Reprise sécurisée', title: 'Cette page ne s’est pas chargée', body: 'Le chargement a été interrompu. Réessayez ou revenez à l’accueil.', safe: 'Aucun ordre, virement ni changement de compte n’a été envoyé.', retry: 'Réessayer', reloading: 'Chargement de la dernière version…', home: 'Retour à l’accueil', reference: 'Réf.' },
    notFound: { kicker: 'Page introuvable', title: 'Cette page n’existe pas', body: 'Le lien est peut-être obsolète, ou la page a été déplacée.', safe: 'Votre compte et vos actifs ne sont pas affectés.', home: 'Retour à l’accueil', help: 'Contacter le support' },
  },
  pt: {
    error: { kicker: 'Recuperação segura', title: 'Esta página não carregou', body: 'Algo interrompeu a página. Tente de novo ou volte ao início.', safe: 'Nenhuma ordem, transferência ou alteração de conta foi enviada.', retry: 'Tentar de novo', reloading: 'Carregando a versão mais recente…', home: 'Voltar ao início', reference: 'Ref.' },
    notFound: { kicker: 'Página não encontrada', title: 'Esta página não existe', body: 'O link pode estar desatualizado ou a página foi movida.', safe: 'Sua conta e seus ativos não foram afetados.', home: 'Voltar ao início', help: 'Falar com o suporte' },
  },
}
