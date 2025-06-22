import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Save, X, Plus, Search, Filter, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  age: string | null;
  sexe: string | null;
  telephone: string | null;
  role: string;
}

interface UserManagementProps {
  token: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ token }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    email: '',
    nom: '',
    prenom: '',
    age: '',
    sexe: '',
    telephone: '',
    role: 'patient'
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:8000/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error('Erreur lors du chargement des utilisateurs');
      }
    } catch (error) {
      console.error('Erreur réseau:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setEditForm({ ...user });
  };

  const handleSave = async (userId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, ...editForm } : user
        ));
        setEditingUser(null);
        setEditForm({});
      } else {
        alert('Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleAddUser = async () => {
    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newUser,
          password: 'password123' // Mot de passe temporaire
        })
      });

      if (response.ok) {
        await fetchUsers(); // Recharger la liste
        setShowAddForm(false);
        setNewUser({
          email: '',
          nom: '',
          prenom: '',
          age: '',
          sexe: '',
          telephone: '',
          role: 'patient'
        });
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      alert('Erreur lors de l\'ajout de l\'utilisateur');
    }
  };

  const handleBack = () => {
    navigate("/admin");
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.nom && user.nom.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.prenom && user.prenom.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestion des Utilisateurs</h1>
        <p className="text-gray-600">Gérez les comptes utilisateurs de la plateforme</p>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par email, nom ou prénom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les rôles</option>
            <option value="patient">Patients</option>
            <option value="medecin">Médecins</option>
          </select>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Ajouter un nouvel utilisateur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Nom"
              value={newUser.nom || ''}
              onChange={(e) => setNewUser({...newUser, nom: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Prénom"
              value={newUser.prenom || ''}
              onChange={(e) => setNewUser({...newUser, prenom: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Âge"
              value={newUser.age || ''}
              onChange={(e) => setNewUser({...newUser, age: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newUser.sexe || ''}
              onChange={(e) => setNewUser({...newUser, sexe: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner le sexe</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
            <input
              type="tel"
              placeholder="Téléphone"
              value={newUser.telephone || ''}
              onChange={(e) => setNewUser({...newUser, telephone: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="patient">Patient</option>
              <option value="medecin">Médecin</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Ajouter
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Tableau des utilisateurs */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Âge</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sexe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      value={editForm.nom || ''}
                      onChange={(e) => setEditForm({...editForm, nom: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    user.nom || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      value={editForm.prenom || ''}
                      onChange={(e) => setEditForm({...editForm, prenom: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    user.prenom || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      value={editForm.age || ''}
                      onChange={(e) => setEditForm({...editForm, age: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    user.age || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <select
                      value={editForm.sexe || ''}
                      onChange={(e) => setEditForm({...editForm, sexe: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  ) : (
                    user.sexe || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <input
                      type="tel"
                      value={editForm.telephone || ''}
                      onChange={(e) => setEditForm({...editForm, telephone: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    user.telephone || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingUser === user.id ? (
                    <select
                      value={editForm.role || ''}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      disabled={user.role === 'admin'}
                    >
                      <option value="patient">Patient</option>
                      <option value="medecin">Médecin</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'medecin' 
                        ? 'bg-green-100 text-green-800' 
                        : user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'medecin' ? 'Médecin' : user.role === 'admin' ? 'Admin' : 'Patient'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {editingUser === user.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(user.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingUser(null);
                          setEditForm({});
                        }}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {/* Masquer les boutons d'action pour l'admin */}
                      {user.role !== 'admin' && (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {user.role === 'admin' && (
                        <span className="text-gray-400 text-xs">Actions non autorisées</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucun utilisateur trouvé
        </div>
      )}
    </div>
  );
};

export default UserManagement; 