# Automatisation IOL Calculator avec Selenium

Ce script Python automatise la saisie de données IOL sur le site ESCRS IOL Calculator en utilisant les données extraites depuis l'application React.

## Installation

1. **Installer Python 3.8+** si ce n'est pas déjà fait

2. **Installer les dépendances** :
   ```bash
   pip install -r requirements.txt
   ```

3. **Installer ChromeDriver** :
   - Le script utilise Chrome comme navigateur
   - ChromeDriver doit être installé et accessible dans le PATH
   - Ou installer via webdriver-manager (inclus dans requirements.txt)

## Utilisation

### 1. Exporter les données depuis l'application React

1. Ouvrez l'application IOL Calculator
2. Uploadez et extrayez les données d'un PDF IOL
3. Cliquez sur le bouton "Exporter vers Selenium"
4. Le fichier `exported_iol_data.json` sera téléchargé

### 2. Placer le fichier JSON

Placez le fichier `exported_iol_data.json` dans le même répertoire que le script Python.

### 3. Lancer le script

```bash
python iol_selenium_automation.py
```

## Configuration

### Mode Debug
Par défaut, le script fonctionne en mode debug :
- Le navigateur reste visible pendant l'exécution
- Le navigateur reste ouvert à la fin pour inspection
- Logs détaillés dans la console

### Mode Production (Headless)
Pour lancer en mode silencieux, modifiez dans le script :
```python
HEADLESS = True
DEBUG = False
```

## Mapping des données

### Données générales
- **Surgeon** : "Tabibian" (fixe)
- **Gender** : "Female" (fixe)
- **Patient Initials** : "ME" (fixe)
- **Patient ID** : Timestamp généré automatiquement
- **Age** : "45" (fixe)

### Données IOL (Œil droit → Left Eye du site)
- **AL** : Longueur axiale (première valeur extraite)
- **ACD** : Profondeur de chambre antérieure 
- **LT** : Épaisseur du cristallin
- **CCT** : Épaisseur cornéenne centrale
- **CD (WTW)** : Distance blanc à blanc
- **K1** : Kératométrie 1 (première valeur)
- **K2** : Kératométrie 2 (première valeur)

### Gestion des données manquantes
- Si une donnée IOL n'est pas disponible, le champ reste vide
- Le script continue sans erreur
- Les champs vides sont signalés dans les logs

## Résultats

- **Captures d'écran** : Sauvegardées automatiquement avec timestamp
- **Logs détaillés** : Affichage de chaque étape dans la console
- **Gestion d'erreurs** : Capture d'écran en cas d'erreur

## Structure du fichier JSON exporté

```json
{
  "surgeon": "Tabibian",
  "gender": "Female",
  "patientInitials": "ME",
  "patientId": "1699123456789",
  "age": "45",
  "iolData": {
    "rightEye": {
      "AL": "24.12",
      "ACD": "3.45",
      "LT": "4.23",
      "CCT": "555",
      "WTW": "11.8",
      "K1": "45.17 / 7.47 @ 178",
      "K2": "46.07 / 7.33 @ 88"
    },
    "leftEye": { ... },
    "rawText": "...",
    "error": false
  }
}
```

## Dépannage

### Erreurs communes

1. **ChromeDriver non trouvé** :
   - Installer ChromeDriver et l'ajouter au PATH
   - Ou utiliser webdriver-manager (inclus)

2. **Fichier JSON non trouvé** :
   - Vérifier que `exported_iol_data.json` est dans le bon répertoire
   - Exporter à nouveau depuis l'application React

3. **Site web inaccessible** :
   - Vérifier la connexion internet
   - Le site ESCRS peut être temporairement indisponible

4. **Champs non remplis** :
   - Vérifier que les données IOL sont correctement extraites
   - Consulter les logs pour voir les valeurs détectées

### Mode verbose
Pour plus de détails, les logs montrent :
- ✅ Actions réussies
- ⚠️ Avertissements (champs vides, etc.)
- ❌ Erreurs
- 📊 Données en cours de traitement
- 📸 Captures d'écran sauvegardées