import type { AppLocale } from './i18n'

/** Full-screen composer, reply bar and member profile editor (X-style publishing). */
export type CommunityComposeCopy = {
  drafts: string; post: string; reply: string; placeholder: string; replyPlaceholder: string
  replyingTo: string; replyBar: string; everyone: string; addImage: string; removeImage: string
  topic: string; noTopic: string; expand: string; close: string; remaining: string
  saveTitle: string; saveDraft: string; discard: string; cancel: string
  draftsTitle: string; draftsEmpty: string; draftUse: string; draftDelete: string
  uploading: string; imageType: string; imageSize: string; imageFailed: string; imageLimit: string; imagesPending: string
  editProfile: string; changeAvatar: string; removeAvatar: string; displayName: string; bio: string; save: string; saving: string
  avatarPending: string; saved: string; saveFailed: string
}

const en: CommunityComposeCopy = {
  drafts: 'Drafts', post: 'Post', reply: 'Reply', placeholder: 'What is happening?', replyPlaceholder: 'Post your reply',
  replyingTo: 'Replying to', replyBar: 'Post your reply', everyone: 'Everyone can reply', addImage: 'Add photos', removeImage: 'Remove photo',
  topic: 'Topic', noTopic: 'No topic', expand: 'Open full composer', close: 'Close', remaining: '{n} characters left',
  saveTitle: 'Save this post as a draft?', saveDraft: 'Save draft', discard: 'Discard', cancel: 'Cancel',
  draftsTitle: 'Drafts', draftsEmpty: 'No drafts yet', draftUse: 'Edit draft', draftDelete: 'Delete draft',
  uploading: 'Uploading…', imageType: 'Only JPEG, PNG, WebP or GIF images can be added.', imageSize: 'Each image must be 10 MB or smaller.', imageFailed: 'The image could not be uploaded. Try again.', imageLimit: 'Up to 4 photos per post.', imagesPending: 'Photos appear publicly after the security scan completes.',
  editProfile: 'Edit profile', changeAvatar: 'Change photo', removeAvatar: 'Remove photo', displayName: 'Name', bio: 'Bio', save: 'Save', saving: 'Saving…',
  avatarPending: 'Your new photo is being checked and will appear shortly.', saved: 'Profile saved.', saveFailed: 'The profile could not be saved. Try again.',
}
const zh: CommunityComposeCopy = {
  drafts: '草稿', post: '发帖', reply: '回复', placeholder: '有什么新鲜事？', replyPlaceholder: '发布你的回复',
  replyingTo: '回复', replyBar: '发布你的回复', everyone: '所有人可以回复', addImage: '添加图片', removeImage: '移除图片',
  topic: '话题', noTopic: '不选话题', expand: '展开完整编辑器', close: '关闭', remaining: '还可输入 {n} 字',
  saveTitle: '要将这条帖子保存为草稿吗？', saveDraft: '保存草稿', discard: '不保存', cancel: '取消',
  draftsTitle: '草稿', draftsEmpty: '暂无草稿', draftUse: '编辑草稿', draftDelete: '删除草稿',
  uploading: '上传中…', imageType: '仅支持 JPEG、PNG、WebP 或 GIF 图片。', imageSize: '单张图片不能超过 10 MB。', imageFailed: '图片上传失败，请重试。', imageLimit: '每条最多 4 张图片。', imagesPending: '图片通过安全扫描后公开显示。',
  editProfile: '编辑资料', changeAvatar: '更换头像', removeAvatar: '移除头像', displayName: '名字', bio: '简介', save: '保存', saving: '保存中…',
  avatarPending: '新头像正在安全检查，稍后显示。', saved: '资料已保存。', saveFailed: '资料保存失败，请重试。',
}
const hi: CommunityComposeCopy = {
  drafts: 'ड्राफ़्ट', post: 'पोस्ट करें', reply: 'जवाब दें', placeholder: 'क्या चल रहा है?', replyPlaceholder: 'अपना जवाब पोस्ट करें',
  replyingTo: 'जवाब दे रहे हैं', replyBar: 'अपना जवाब पोस्ट करें', everyone: 'हर कोई जवाब दे सकता है', addImage: 'फ़ोटो जोड़ें', removeImage: 'फ़ोटो हटाएँ',
  topic: 'विषय', noTopic: 'कोई विषय नहीं', expand: 'पूरा संपादक खोलें', close: 'बंद करें', remaining: '{n} अक्षर शेष',
  saveTitle: 'इस पोस्ट को ड्राफ़्ट के रूप में सहेजें?', saveDraft: 'ड्राफ़्ट सहेजें', discard: 'हटाएँ', cancel: 'रद्द करें',
  draftsTitle: 'ड्राफ़्ट', draftsEmpty: 'अभी कोई ड्राफ़्ट नहीं', draftUse: 'ड्राफ़्ट संपादित करें', draftDelete: 'ड्राफ़्ट हटाएँ',
  uploading: 'अपलोड हो रहा है…', imageType: 'केवल JPEG, PNG, WebP या GIF छवियाँ जोड़ी जा सकती हैं।', imageSize: 'हर छवि 10 MB या उससे छोटी होनी चाहिए।', imageFailed: 'छवि अपलोड नहीं हो सकी। फिर से प्रयास करें।', imageLimit: 'हर पोस्ट में अधिकतम 4 फ़ोटो।', imagesPending: 'सुरक्षा जाँच पूरी होने के बाद फ़ोटो सार्वजनिक दिखेंगी।',
  editProfile: 'प्रोफ़ाइल संपादित करें', changeAvatar: 'फ़ोटो बदलें', removeAvatar: 'फ़ोटो हटाएँ', displayName: 'नाम', bio: 'परिचय', save: 'सहेजें', saving: 'सहेजा जा रहा है…',
  avatarPending: 'आपकी नई फ़ोटो की जाँच हो रही है, जल्द दिखेगी।', saved: 'प्रोफ़ाइल सहेजी गई।', saveFailed: 'प्रोफ़ाइल सहेजी नहीं जा सकी। फिर से प्रयास करें।',
}
const es: CommunityComposeCopy = {
  drafts: 'Borradores', post: 'Publicar', reply: 'Responder', placeholder: '¿Qué está pasando?', replyPlaceholder: 'Publica tu respuesta',
  replyingTo: 'Respondiendo a', replyBar: 'Publica tu respuesta', everyone: 'Cualquiera puede responder', addImage: 'Añadir fotos', removeImage: 'Quitar foto',
  topic: 'Tema', noTopic: 'Sin tema', expand: 'Abrir editor completo', close: 'Cerrar', remaining: 'Quedan {n} caracteres',
  saveTitle: '¿Guardar esta publicación como borrador?', saveDraft: 'Guardar borrador', discard: 'Descartar', cancel: 'Cancelar',
  draftsTitle: 'Borradores', draftsEmpty: 'Aún no hay borradores', draftUse: 'Editar borrador', draftDelete: 'Eliminar borrador',
  uploading: 'Subiendo…', imageType: 'Solo se admiten imágenes JPEG, PNG, WebP o GIF.', imageSize: 'Cada imagen debe pesar 10 MB o menos.', imageFailed: 'No se pudo subir la imagen. Reintenta.', imageLimit: 'Hasta 4 fotos por publicación.', imagesPending: 'Las fotos se muestran tras completar el análisis de seguridad.',
  editProfile: 'Editar perfil', changeAvatar: 'Cambiar foto', removeAvatar: 'Quitar foto', displayName: 'Nombre', bio: 'Biografía', save: 'Guardar', saving: 'Guardando…',
  avatarPending: 'Tu nueva foto se está revisando y aparecerá en breve.', saved: 'Perfil guardado.', saveFailed: 'No se pudo guardar el perfil. Reintenta.',
}
const ar: CommunityComposeCopy = {
  drafts: 'المسودات', post: 'نشر', reply: 'رد', placeholder: 'ما الجديد؟', replyPlaceholder: 'انشر ردك',
  replyingTo: 'ردًا على', replyBar: 'انشر ردك', everyone: 'يمكن للجميع الرد', addImage: 'إضافة صور', removeImage: 'إزالة الصورة',
  topic: 'الموضوع', noTopic: 'بلا موضوع', expand: 'فتح المحرر الكامل', close: 'إغلاق', remaining: 'متبقٍ {n} حرفًا',
  saveTitle: 'حفظ هذا المنشور كمسودة؟', saveDraft: 'حفظ المسودة', discard: 'تجاهل', cancel: 'إلغاء',
  draftsTitle: 'المسودات', draftsEmpty: 'لا توجد مسودات بعد', draftUse: 'تعديل المسودة', draftDelete: 'حذف المسودة',
  uploading: 'جارٍ الرفع…', imageType: 'يمكن إضافة صور JPEG أو PNG أو WebP أو GIF فقط.', imageSize: 'يجب ألا يتجاوز حجم كل صورة 10 ميغابايت.', imageFailed: 'تعذر رفع الصورة. حاول مجددًا.', imageLimit: 'حتى 4 صور لكل منشور.', imagesPending: 'تظهر الصور للعامة بعد اكتمال الفحص الأمني.',
  editProfile: 'تعديل الملف', changeAvatar: 'تغيير الصورة', removeAvatar: 'إزالة الصورة', displayName: 'الاسم', bio: 'نبذة', save: 'حفظ', saving: 'جارٍ الحفظ…',
  avatarPending: 'يجري فحص صورتك الجديدة وستظهر قريبًا.', saved: 'تم حفظ الملف.', saveFailed: 'تعذر حفظ الملف. حاول مجددًا.',
}
const fr: CommunityComposeCopy = {
  drafts: 'Brouillons', post: 'Publier', reply: 'Répondre', placeholder: 'Quoi de neuf ?', replyPlaceholder: 'Publiez votre réponse',
  replyingTo: 'En réponse à', replyBar: 'Publiez votre réponse', everyone: 'Tout le monde peut répondre', addImage: 'Ajouter des photos', removeImage: 'Retirer la photo',
  topic: 'Sujet', noTopic: 'Sans sujet', expand: 'Ouvrir l’éditeur complet', close: 'Fermer', remaining: '{n} caractères restants',
  saveTitle: 'Enregistrer cette publication en brouillon ?', saveDraft: 'Enregistrer', discard: 'Supprimer', cancel: 'Annuler',
  draftsTitle: 'Brouillons', draftsEmpty: 'Aucun brouillon', draftUse: 'Modifier le brouillon', draftDelete: 'Supprimer le brouillon',
  uploading: 'Envoi…', imageType: 'Seules les images JPEG, PNG, WebP ou GIF sont acceptées.', imageSize: 'Chaque image doit faire 10 Mo au maximum.', imageFailed: 'L’image n’a pas pu être envoyée. Réessayez.', imageLimit: 'Jusqu’à 4 photos par publication.', imagesPending: 'Les photos s’affichent après le contrôle de sécurité.',
  editProfile: 'Modifier le profil', changeAvatar: 'Changer la photo', removeAvatar: 'Retirer la photo', displayName: 'Nom', bio: 'Bio', save: 'Enregistrer', saving: 'Enregistrement…',
  avatarPending: 'Votre nouvelle photo est en cours de vérification.', saved: 'Profil enregistré.', saveFailed: 'Le profil n’a pas pu être enregistré. Réessayez.',
}
const pt: CommunityComposeCopy = {
  drafts: 'Rascunhos', post: 'Postar', reply: 'Responder', placeholder: 'O que está acontecendo?', replyPlaceholder: 'Poste sua resposta',
  replyingTo: 'Respondendo a', replyBar: 'Poste sua resposta', everyone: 'Qualquer pessoa pode responder', addImage: 'Adicionar fotos', removeImage: 'Remover foto',
  topic: 'Tópico', noTopic: 'Sem tópico', expand: 'Abrir editor completo', close: 'Fechar', remaining: 'Restam {n} caracteres',
  saveTitle: 'Salvar esta publicação como rascunho?', saveDraft: 'Salvar rascunho', discard: 'Descartar', cancel: 'Cancelar',
  draftsTitle: 'Rascunhos', draftsEmpty: 'Nenhum rascunho ainda', draftUse: 'Editar rascunho', draftDelete: 'Excluir rascunho',
  uploading: 'Enviando…', imageType: 'Somente imagens JPEG, PNG, WebP ou GIF podem ser adicionadas.', imageSize: 'Cada imagem deve ter até 10 MB.', imageFailed: 'Não foi possível enviar a imagem. Tente novamente.', imageLimit: 'Até 4 fotos por publicação.', imagesPending: 'As fotos aparecem após a verificação de segurança.',
  editProfile: 'Editar perfil', changeAvatar: 'Trocar foto', removeAvatar: 'Remover foto', displayName: 'Nome', bio: 'Bio', save: 'Salvar', saving: 'Salvando…',
  avatarPending: 'Sua nova foto está sendo verificada e aparecerá em breve.', saved: 'Perfil salvo.', saveFailed: 'Não foi possível salvar o perfil. Tente novamente.',
}

export const communityComposeCopy: Record<AppLocale, CommunityComposeCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
