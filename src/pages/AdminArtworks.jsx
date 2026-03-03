import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import "../styles/adminArtworks.css";
import "../styles/typesManager.css";
import AdminHeader from "../components/AdminHeader";
import TypesManager from "../components/TypesManager";
import AdminCard from "../components/AdminCard";
import SortButton from "../components/SortButton";
import {
  getAllArtworksAdmin,
  deleteArtworkById,
} from "../api/artworks";
import { getAllArtworkTypes } from "../api/artworkTypes";

export default function Admin() {
  const navigate = useNavigate();
  const [artworks, setArtworks] = useState([]);
  const [artworkTypes, setArtworkTypes] = useState([]);
  const [currentSort, setCurrentSort] = useState({ field: "title", direction: "asc" });

  useEffect(() => {
    fetchArtworks();
    fetchArtworkTypes();
  }, []);

  const fetchArtworks = async () => {
    const data = await getAllArtworksAdmin();
    setArtworks(data);
  };

  const fetchArtworkTypes = async () => {
    try {
      // Récupérer directement les types depuis l'API
      const types = await getAllArtworkTypes();
      setArtworkTypes(types);
    } catch (error) {
      console.error('Erreur lors du chargement des types d\'œuvres:', error);
      // En cas d'erreur, afficher un tableau vide
      setArtworkTypes([]);
    }
  };

  const sortedArtworks = [...artworks].sort((a, b) => {
    let result = 0;
    
    switch (currentSort.field) {
      case "title":
        result = a.title.localeCompare(b.title);
        break;
      case "price":
        result = a.price - b.price;
        break;
      case "date":
        result = new Date(b.created_at || b.createdAt || Date.now()) - new Date(a.created_at || a.createdAt || Date.now());
        break;
      case "status":
        // Tri par statut : Disponible > Indisponible > Vendu
        const statusOrder = { "Disponible": 3, "Indisponible": 2, "Vendu": 1 };
        const statusA = artwork => artwork.status || (artwork.is_available ? "Disponible" : "Vendu");
        const statusB = artwork => artwork.status || (artwork.is_available ? "Disponible" : "Vendu");
        result = (statusOrder[statusA(b)] || 0) - (statusOrder[statusA(a)] || 0);
        break;
      default:
        result = 0;
    }
    
    return currentSort.direction === 'desc' ? -result : result;
  });

  const handleSort = (sortConfig) => {
    setCurrentSort(sortConfig);
  };

  return (
    <>
      <AdminHeader />
      <div className="admin-container">
        <div className="admin-page-header">
          <h1 style={{ fontFamily: 'Dancing Script', fontSize: '3rem', color: '#2c3e50', margin: 0 }}>
            Gestion des Œuvres
          </h1>
          <div className="header-actions">
            <TypesManager 
              availableTypes={artworkTypes}
              onTypesChange={setArtworkTypes}
            />
            <button className="add-artwork-btn" onClick={() => navigate('/admin/artworks/new')}>
              <FaPlus />
              Ajouter une œuvre
            </button>
          </div>
        </div>
        <div className="admin-controls">
          <div className="sort-buttons-group">
            <span className="sort-buttons-label">Trier par :</span>
            <SortButton
              field="title"
              currentSort={currentSort}
              onSort={handleSort}
              label="Titre"
              size="medium"
            />
            <SortButton
              field="price"
              currentSort={currentSort}
              onSort={handleSort}
              label="Prix"
              size="medium"
            />
            <SortButton
              field="date"
              currentSort={currentSort}
              onSort={handleSort}
              label="Date"
              size="medium"
            />
            <SortButton
              field="status"
              currentSort={currentSort}
              onSort={handleSort}
              label="Disponibilité"
              size="medium"
            />
          </div>
        </div>
        <div className="artworks-grid">
          {sortedArtworks.map((artwork) => (
            <AdminCard
              key={artwork._id}
              item={artwork}
              type="artwork"
              onEdit={() => navigate(`/admin/artworks/${artwork._id}`)}
              onDelete={async (item) => {
                if (window.confirm("Voulez-vous vraiment supprimer ce tableau ? Cette action est irréversible.")) {
                  const artworkId = item.id || item._id;
                  await deleteArtworkById(artworkId);
                  await fetchArtworks();
                }
              }}
              statusIndicator={
                artwork.status === 'Disponible' ? 'available' : 
                artwork.status === 'Vendu' ? 'sold' : 
                artwork.status === 'Indisponible' ? 'unavailable' :
                artwork.is_available ? 'available' : 'sold'  // Fallback pour compatibilité
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
