import type { AppLocale } from '@/lib/i18n'
import type { HomeVariant, Lifecycle } from '@/lib/home-lifecycle'

type StateCopy = { lifecycle: Record<Lifecycle, string>; variant: Record<Exclude<HomeVariant, null>, string>; degraded: string; live: string; next: string }

export const homeStateCopy: Record<AppLocale, StateCopy> = {
  en: {
    lifecycle: { guest: 'Start with real assets', email_unverified: 'Confirm your email', kyc_incomplete: 'Complete verification', unfunded: 'Your account is ready', funded: 'Ready to discover', invested: 'Your assets in motion' },
    variant: { kyc_in_progress: 'Verification in progress', kyc_submitted: 'Application under review', kyc_needs_information: 'More information needed', kyc_rejected: 'Review your application', kyc_expired: 'Renew verification', funded_locked_only: 'Funds are pending', invested_restricted: 'Account review required' },
    degraded: 'Some account information is unavailable', live: 'LIVE MODE', next: 'NEXT STEP',
  },
  'zh-CN': {
    lifecycle: { guest: '从真实资产开始', email_unverified: '确认你的邮箱', kyc_incomplete: '完成身份认证', unfunded: '账户已就绪', funded: '探索投资机会', invested: '资产正在运行' },
    variant: { kyc_in_progress: '认证正在进行', kyc_submitted: '资料审核中', kyc_needs_information: '请补充资料', kyc_rejected: '请查看认证结果', kyc_expired: '请更新认证', funded_locked_only: '资金处理中', invested_restricted: '账户需要复核' },
    degraded: '部分账户信息暂不可用', live: '真实模式', next: '下一步',
  },
  hi: {
    lifecycle: { guest: 'वास्तविक संपत्ति से शुरुआत', email_unverified: 'ईमेल की पुष्टि करें', kyc_incomplete: 'पहचान सत्यापित करें', unfunded: 'खाता तैयार है', funded: 'अवसर देखें', invested: 'आपकी संपत्ति सक्रिय है' },
    variant: { kyc_in_progress: 'सत्यापन जारी है', kyc_submitted: 'आवेदन की समीक्षा हो रही है', kyc_needs_information: 'अधिक जानकारी चाहिए', kyc_rejected: 'आवेदन की समीक्षा करें', kyc_expired: 'सत्यापन नवीनीकृत करें', funded_locked_only: 'धन लंबित है', invested_restricted: 'खाते की समीक्षा आवश्यक' },
    degraded: 'खाते की कुछ जानकारी उपलब्ध नहीं', live: 'लाइव मोड', next: 'अगला कदम',
  },
  es: {
    lifecycle: { guest: 'Empieza con activos reales', email_unverified: 'Confirma tu correo', kyc_incomplete: 'Completa la verificación', unfunded: 'Tu cuenta está lista', funded: 'Descubre oportunidades', invested: 'Tus activos en movimiento' },
    variant: { kyc_in_progress: 'Verificación en curso', kyc_submitted: 'Solicitud en revisión', kyc_needs_information: 'Falta información', kyc_rejected: 'Revisa tu solicitud', kyc_expired: 'Renueva la verificación', funded_locked_only: 'Fondos pendientes', invested_restricted: 'La cuenta requiere revisión' },
    degraded: 'Parte de la información no está disponible', live: 'MODO REAL', next: 'SIGUIENTE PASO',
  },
  ar: {
    lifecycle: { guest: 'ابدأ بالأصول الحقيقية', email_unverified: 'أكّد بريدك الإلكتروني', kyc_incomplete: 'أكمل التحقق', unfunded: 'حسابك جاهز', funded: 'اكتشف الفرص', invested: 'أصولك تعمل الآن' },
    variant: { kyc_in_progress: 'التحقق جارٍ', kyc_submitted: 'الطلب قيد المراجعة', kyc_needs_information: 'معلومات إضافية مطلوبة', kyc_rejected: 'راجع طلبك', kyc_expired: 'جدّد التحقق', funded_locked_only: 'الأموال قيد المعالجة', invested_restricted: 'الحساب يحتاج إلى مراجعة' },
    degraded: 'بعض بيانات الحساب غير متاحة', live: 'الوضع الحقيقي', next: 'الخطوة التالية',
  },
  fr: {
    lifecycle: { guest: 'Commencez avec les actifs réels', email_unverified: 'Confirmez votre e-mail', kyc_incomplete: 'Terminez la vérification', unfunded: 'Votre compte est prêt', funded: 'Explorez les opportunités', invested: 'Vos actifs en mouvement' },
    variant: { kyc_in_progress: 'Vérification en cours', kyc_submitted: 'Dossier en examen', kyc_needs_information: 'Informations manquantes', kyc_rejected: 'Vérifiez votre dossier', kyc_expired: 'Renouvelez la vérification', funded_locked_only: 'Fonds en attente', invested_restricted: 'Révision du compte requise' },
    degraded: 'Certaines données du compte sont indisponibles', live: 'MODE RÉEL', next: 'PROCHAINE ÉTAPE',
  },
  pt: {
    lifecycle: { guest: 'Comece pelos ativos reais', email_unverified: 'Confirme seu e-mail', kyc_incomplete: 'Conclua a verificação', unfunded: 'Sua conta está pronta', funded: 'Explore oportunidades', invested: 'Seus ativos em movimento' },
    variant: { kyc_in_progress: 'Verificação em andamento', kyc_submitted: 'Pedido em análise', kyc_needs_information: 'Mais informações necessárias', kyc_rejected: 'Revise seu pedido', kyc_expired: 'Renove a verificação', funded_locked_only: 'Fundos pendentes', invested_restricted: 'Revisão da conta necessária' },
    degraded: 'Alguns dados da conta estão indisponíveis', live: 'MODO REAL', next: 'PRÓXIMO PASSO',
  },
}
