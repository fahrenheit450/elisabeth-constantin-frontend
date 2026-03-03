import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getArtworkByIdAdmin,
  createArtwork,
  updateArtwork,
  deleteArtworkById,
  translateDescription,
  updateDescriptionEn,
  translateTitle,
  updateTitleEn,
} from '../api/artworks';
import { getAllArtworkTypes } from '../api/artworkTypes';
import { FaTrash, FaSave, FaArrowLeft, FaLanguage, FaSync } from 'react-icons/fa';
import AdminHeader from '../components/AdminHeader';
import ImageUpload from '../components/ImageUpload';
import '../styles/adminArtworkDetail.css';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function AdminArtworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewArtwork = id === 'new';
  
  const [loading, setLoading] = useState(!isNewArtwork);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [artworkTypes, setArtworkTypes] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    width: "",
    height: "",
    type: "peinture",
    status: "Disponible",
    main_image: null,
    other_images: [],
  });
  
  const [descriptionLang, setDescriptionLang] = useState('fr'); // 'fr' ou 'en'
  const [descriptionEn, setDescriptionEn] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
  const [fontSizeInput, setFontSizeInput] = useState('');
  const editorRefFr = useRef(null);
  const editorRefEn = useRef(null);
  const editorRefs = {
    fr: editorRefFr,
    en: editorRefEn,
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchArtworkTypes();
    
    if (!isNewArtwork) {
      fetchArtwork();
    }
  }, [id]);

  const fetchArtworkTypes = async () => {
    try {
      const types = await getAllArtworkTypes();
      // Debug: log types shape to help identify format (string[] or object[])
      console.debug('Fetched artwork types:', types);
      setArtworkTypes(types);
    } catch (error) {
      console.error('Erreur lors du chargement des types:', error);
      setArtworkTypes([]);
    }
  };

  const fetchArtwork = async () => {
    try {
      setLoading(true);
      // Admin must edit FR source-of-truth fields to prevent FR/EN mixing.
      const artwork = await getArtworkByIdAdmin(id);
      
      setFormData({
        title: artwork.title || "",
        description: artwork.description || "",
        price: artwork.price?.toString() || "",
        width: artwork.width?.toString() || "",
        height: artwork.height?.toString() || "",
        // Normalize type: API may return a string or an object
        type: typeof artwork.type === 'string' ? artwork.type : (artwork.type && (artwork.type.name || artwork.type._id)) || "peinture",
        status: artwork.status || (artwork.is_available ? "Disponible" : "Vendu"),
        main_image: artwork.main_image || null,
        other_images: artwork.other_images || [],
      });
      
      // Charger la traduction anglaise si elle existe
      if (artwork.translations && artwork.translations.en && artwork.translations.en.description) {
        setDescriptionEn(artwork.translations.en.description);
      }
      if (artwork.translations && artwork.translations.en && artwork.translations.en.title) {
        setTitleEn(artwork.translations.en.title);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du tableau:', error);
      alert('Erreur lors du chargement du tableau');
      navigate('/admin/artworks');
    } finally {
      setLoading(false);
    }
  };

  const syncEditorContent = (lang, value) => {
    const editor = editorRefs[lang]?.current;
    if (editor && editor.innerHTML !== (value || '')) {
      editor.innerHTML = value || '';
    }
  };

useEffect(() => {
  syncEditorContent('fr', formData.description);
}, [formData.description]);

useEffect(() => {
  syncEditorContent('en', descriptionEn);
}, [descriptionEn]);

useEffect(() => {
  if (descriptionLang === 'fr') {
    syncEditorContent('fr', formData.description);
  } else {
    syncEditorContent('en', descriptionEn);
  }
  updateFontSizeInputFromSelection();
}, [descriptionLang]);

useEffect(() => {
  const handler = () => updateFontSizeInputFromSelection();
  document.addEventListener('selectionchange', handler);
  return () => document.removeEventListener('selectionchange', handler);
}, []);

  const handleEditorInput = (lang, html) => {
    if (lang === 'fr') {
      setFormData((prev) => ({ ...prev, description: html }));
    } else {
      setDescriptionEn(html);
    }
  };

  const getActiveEditor = () => editorRefs[descriptionLang]?.current;

  const ensureEditorSelection = () => {
    const editor = getActiveEditor();
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return editor;
  };

  const handleFormattingClick = (command) => {
    const editor = ensureEditorSelection();
    if (!editor) return;
    document.execCommand(command, false, null);
    handleEditorInput(descriptionLang, editor.innerHTML);
  };

  const applyFontSizeToSelection = (size) => {
    if (!size) return;
    const editor = ensureEditorSelection();
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = size;

    if (range.collapsed) {
      span.textContent = 'Texte';
      range.insertNode(span);
    } else {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    handleEditorInput(descriptionLang, editor.innerHTML);
    const numeric = parseInt(size, 10);
    setFontSizeInput(Number.isNaN(numeric) ? '' : String(numeric));
  };

  const updateFontSizeInputFromSelection = () => {
    const editor = getActiveEditor();
    if (!editor) {
      setFontSizeInput('');
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      setFontSizeInput('');
      return;
    }
    let node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    if (!node || !(node instanceof HTMLElement)) {
      setFontSizeInput('');
      return;
    }
    const computed = window.getComputedStyle(node);
    const numeric = parseInt(computed.fontSize || '', 10);
    setFontSizeInput(Number.isNaN(numeric) ? '' : String(numeric));
  };


  // Upload Cloudinary pour image principale
  const handleMainImageChange = async (image) => {
    if (!image) {
      setFormData((prev) => ({ ...prev, main_image: null }));
      return;
    }
    if (typeof image === "string") {
      setFormData((prev) => ({ ...prev, main_image: image }));
      return;
    }
    setIsUploading(true);
    try {
      const formCloud = new FormData();
      formCloud.append("file", image);
      formCloud.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        { method: "POST", body: formCloud }
      );
      const cloudData = await cloudRes.json();
      if (cloudData.secure_url) {
        setFormData((prev) => ({ ...prev, main_image: cloudData.secure_url }));
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploading(false);
    }
  };

  // Upload Cloudinary pour images secondaires
  const handleOtherImagesChange = async (images) => {
    setIsUploading(true);
    const urls = [];
    for (const img of images) {
      if (typeof img === "string") {
        urls.push(img);
      } else {
        try {
          const formCloud = new FormData();
          formCloud.append("file", img);
          formCloud.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
          const cloudRes = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
            { method: "POST", body: formCloud }
          );
          const cloudData = await cloudRes.json();
          if (cloudData.secure_url) urls.push(cloudData.secure_url);
        } catch (error) {
          console.error('Erreur lors de l\'upload:', error);
        }
      }
    }
    setFormData((prev) => ({ ...prev, other_images: urls }));
    setIsUploading(false);
  };

  const handleTranslate = async () => {
    if (!formData.description || !formData.description.trim()) {
      alert("La description française est vide !");
      return;
    }
    
    if (!id || isNewArtwork) {
      alert("Veuillez d'abord sauvegarder l'œuvre avant de traduire.");
      return;
    }
    
    try {
      setIsTranslating(true);
      const result = await translateDescription(id, formData.description);
      setDescriptionEn(result.description_en);
    } catch (error) {
      console.error("Erreur de traduction:", error);
      alert("Échec de la traduction: " + error.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateTitle = async () => {
    if (!formData.title || !formData.title.trim()) {
      alert("Le titre français est vide !");
      return;
    }

    if (!id || isNewArtwork) {
      alert("Veuillez d'abord sauvegarder l'œuvre avant de traduire.");
      return;
    }

    try {
      setIsTranslatingTitle(true);
      const result = await translateTitle(id, formData.title);
      setTitleEn(result.title_en);
    } catch (error) {
      console.error("Erreur de traduction du titre:", error);
      alert("Échec de la traduction: " + error.message);
    } finally {
      setIsTranslatingTitle(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      alert("Le titre est obligatoire !");
      return;
    }
    if (!formData.main_image) {
      alert("L'image principale est obligatoire !");
      return;
    }
    if (!formData.price || isNaN(parseFloat(formData.price))) {
      alert("Le prix doit être un nombre valide !");
      return;
    }
    if (!formData.width || isNaN(parseFloat(formData.width))) {
      alert("La largeur doit être un nombre valide !");
      return;
    }
    if (!formData.height || isNaN(parseFloat(formData.height))) {
      alert("La hauteur doit être un nombre valide !");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        width: parseFloat(formData.width),
        height: parseFloat(formData.height),
        type: formData.type,
        status: formData.status,
        main_image: formData.main_image,
        other_images: formData.other_images,
      };
      
      let artworkId = id;
      if (isNewArtwork) {
        const created = await createArtwork(payload);
        artworkId = created._id;
      } else {
        await updateArtwork(id, payload);
      }
      
      // Si la description EN a été modifiée, la sauvegarder aussi
      if (descriptionEn && descriptionEn.trim() && !isNewArtwork) {
        await updateDescriptionEn(artworkId, descriptionEn);
      }

      // Si le titre EN a été modifié, le sauvegarder aussi
      if (titleEn && titleEn.trim() && !isNewArtwork) {
        await updateTitleEn(artworkId, titleEn);
      }
      
      navigate('/admin/artworks');
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Une erreur s'est produite lors de la sauvegarde: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer ce tableau ? Cette action est irréversible.")) {
      try {
        await deleteArtworkById(id);
        navigate('/admin/artworks');
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Une erreur s'est produite lors de la suppression");
      }
    }
  };

  if (loading) {
    return (
      <>
        <AdminHeader />
        <div className="admin-artwork-detail">
          <div className="loading">Chargement...</div>
        </div>
      </>
    );
  }

  // Toutes les images (principale + secondaires)
  const allImages = [formData.main_image, ...formData.other_images].filter(img => img);

  return (
    <>
      <AdminHeader />
      <div className="tableau-detail">
        <div className="admin-top-bar">
          <button className="back-btn" onClick={() => navigate('/admin/artworks')}>
            <FaArrowLeft /> Retour
          </button>
          <h2 className="admin-page-title">
            {isNewArtwork ? 'Nouvelle œuvre' : 'Modifier l\'œuvre'}
          </h2>
          <div className="admin-actions">
            {!isNewArtwork && (
              <button
                type="button"
                className="delete-btn-top"
                onClick={handleDelete}
              >
                <FaTrash /> Supprimer
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="save-btn-top"
              disabled={saving || isUploading}
            >
              <FaSave /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <div className="tableau-container">
          {/* Galerie photos - Gauche */}
          <div className="tableau-gallery">
            <div className="main-image-container">
              <div className="main-image">
                {allImages.length > 0 ? (
                  <img 
                    src={allImages[selectedImage]} 
                    alt={formData.title || "Aperçu"}
                  />
                ) : (
                  <div className="no-image-placeholder">
                    <ImageUpload
                      images={formData.main_image}
                      onImagesChange={handleMainImageChange}
                      multiple={false}
                      showInCanvas={true}
                      label=""
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload d'images secondaires sous l'image principale */}
            <div className="secondary-upload-section">
              <ImageUpload
                images={formData.other_images}
                onImagesChange={handleOtherImagesChange}
                multiple={true}
                label=""
              />
            </div>

            {isUploading && (
              <div className="upload-status">
                Upload en cours...
              </div>
            )}
          </div>

          {/* Informations - Droite */}
          <div className="tableau-info">
            <input
              type="text"
              className="tableau-titre editable"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Titre de l'œuvre"
            />

            <div className="editable-container" style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="tableau-titre editable en-title"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Title (EN)"
                  disabled={isNewArtwork}
                />
                {!isNewArtwork && (
                  <button
                    type="button"
                    className="translate-btn"
                    onClick={handleTranslateTitle}
                    disabled={isTranslatingTitle || !formData.title}
                    title="Traduire le titre français en anglais"
                  >
                    {isTranslatingTitle ? (
                      <>
                        <FaSync className="spin" /> Traduction...
                      </>
                    ) : (
                      <>
                        <FaLanguage /> Traduire
                      </>
                    )}
                  </button>
                )}
              </div>
              {isNewArtwork && (
                <p className="description-hint" style={{ marginTop: '0.25rem' }}>
                  💡 Sauvegardez d'abord l'œuvre pour activer la traduction
                </p>
              )}
            </div>
            
            <div className="tableau-prix editable-container">
              <input
                type="number"
                step="0.01"
                className="tableau-prix-input"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="Prix"
              />
              <span>€</span>
            </div>

            <div className="tableau-details">
              <div className="detail-item">
                <span className="detail-label">Dimensions :</span>
                <span className="detail-value editable-inline">
                  <input
                    type="number"
                    step="0.1"
                    className="dimension-input"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                    placeholder="L"
                  />
                  {' x '}
                  <input
                    type="number"
                    step="0.1"
                    className="dimension-input"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    placeholder="H"
                  />
                  {' cm'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Technique :</span>
                <select
                  className="detail-value-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {artworkTypes && artworkTypes.length > 0 ? (
                    artworkTypes.map((type, index) => {
                      // type may be a string or an object { _id, name }
                      const value = typeof type === 'string' ? type : (type.name || type._id);
                      const label = typeof type === 'string' ? (type.charAt(0).toUpperCase() + type.slice(1)) : (type.name || type._id);
                      return (
                        <option key={value || `type-${index}`} value={value}>
                          {label}
                        </option>
                      );
                    })
                  ) : (
                    <option value="peinture">Peinture</option>
                  )}
                </select>
              </div>
              <div className="detail-item">
                <span className="detail-label">Disponibilité :</span>
                <select
                  className={`detail-value-select-status ${formData.status === 'Disponible' ? 'status-disponible' : 'status-indisponible'}`}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Indisponible">Indisponible</option>
                  <option value="Vendu">Vendu</option>
                </select>
              </div>
            </div>

            <div className="tableau-description">
              <div className="description-header">
                <h3>Description</h3>
                <div className="description-controls">
                  <div className="lang-switch">
                    <button
                      type="button"
                      className={`lang-btn ${descriptionLang === 'fr' ? 'active' : ''}`}
                      onClick={() => setDescriptionLang('fr')}
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      className={`lang-btn ${descriptionLang === 'en' ? 'active' : ''}`}
                      onClick={() => setDescriptionLang('en')}
                    >
                      EN
                    </button>
                  </div>
                  {descriptionLang === 'en' && !isNewArtwork && (
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={handleTranslate}
                      disabled={isTranslating || !formData.description}
                      title="Traduire la description française en anglais"
                    >
                      {isTranslating ? (
                        <>
                          <FaSync className="spin" /> Traduction...
                        </>
                      ) : (
                        <>
                          <FaLanguage /> Traduire
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="markdown-toolbar">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => handleFormattingClick('bold')}
                  title="Gras"
                >
                  G
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => handleFormattingClick('italic')}
                  title="Italique"
                >
                  I
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => handleFormattingClick('underline')}
                  title="Souligner"
                >
                  S
                </button>
                <div className="toolbar-custom-size">
                  <input
                    type="number"
                    className="toolbar-input"
                    placeholder="px"
                    value={fontSizeInput}
                    onChange={(e) => setFontSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const numeric = parseInt(fontSizeInput, 10);
                        if (!Number.isNaN(numeric) && numeric > 0) {
                          applyFontSizeToSelection(`${numeric}px`);
                        }
                      }
                    }}
                    min="8"
                    max="120"
                  />
                  <button
                    type="button"
                    className="toolbar-btn apply-size"
                    onClick={() => {
                      const numeric = parseInt(fontSizeInput, 10);
                      if (!Number.isNaN(numeric) && numeric > 0) {
                        applyFontSizeToSelection(`${numeric}px`);
                      }
                    }}
                    title="Appliquer la taille"
                  >
                    OK
                  </button>
                </div>
              </div>

              {(() => {
                const isDisabled = descriptionLang === 'en' && isNewArtwork;
                const ref = descriptionLang === 'fr' ? editorRefFr : editorRefEn;
                return (
                  <div
                    key={descriptionLang}
                    ref={ref}
                    className={`description-editor ${isDisabled ? 'disabled' : ''}`}
                    contentEditable={!isDisabled}
                    suppressContentEditableWarning
                    onInput={(e) => handleEditorInput(descriptionLang, e.currentTarget.innerHTML)}
                    data-placeholder={
                      descriptionLang === 'fr'
                        ? "Description de l'œuvre en français..."
                        : "Description de l'œuvre en anglais..."
                    }
                  />
                );
              })()}
              
              {descriptionLang === 'en' && isNewArtwork && (
                <p className="description-hint">
                  💡 Sauvegardez d'abord l'œuvre pour activer la traduction
                </p>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
