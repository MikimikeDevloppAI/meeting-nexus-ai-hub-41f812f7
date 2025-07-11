#!/usr/bin/env python3
"""
Script Selenium pour automatiser la saisie de données IOL sur le site ESCRS IOL Calculator.
Lit un fichier JSON exporté depuis l'application React et remplit automatiquement le formulaire.
"""

import json
import time
import os
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


def setup_driver(headless=False, debug=False):
    """Configure et retourne le driver Chrome avec les options appropriées."""
    options = Options()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("--window-size=1920,1080")
    
    if headless:
        options.add_argument('--headless')
    
    driver = webdriver.Chrome(options=options)
    return driver


def load_iol_data(json_file_path):
    """Charge les données IOL depuis le fichier JSON exporté."""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            print(f"✅ Données IOL chargées depuis {json_file_path}")
            return data
    except FileNotFoundError:
        print(f"❌ Fichier {json_file_path} non trouvé")
        return None
    except json.JSONDecodeError:
        print(f"❌ Erreur de lecture JSON dans {json_file_path}")
        return None


def extract_first_value(value_string):
    """Extrait la première valeur numérique d'une string (ex: '45.17 / 7.47 @ 178' -> '45.17')."""
    if not value_string or value_string == '-':
        return ""
    
    # Divise par des espaces ou par '/'
    parts = value_string.replace('/', ' ').split()
    for part in parts:
        try:
            # Vérifie si c'est un nombre valide
            float(part)
            return part
        except ValueError:
            continue
    return ""


def select_gender(driver, wait, gender_value="Female"):
    """Sélectionne le genre dans le dropdown."""
    try:
        print(f"⏳ Localisation du dropdown genre...")
        dropdown_container = wait.until(EC.element_to_be_clickable((
            By.XPATH, "//div[contains(@class, 'mud-select')]"
        )))

        print(f"🖱️ Ouverture du dropdown pour sélectionner '{gender_value}'...")
        ActionChains(driver).move_to_element(dropdown_container).click().perform()

        print("⏳ Attente de l'ouverture du dropdown...")
        dropdown_popup = wait.until(EC.presence_of_element_located((
            By.XPATH, "//div[contains(@class, 'mud-popover-open')]"
        )))
        time.sleep(0.5)

        print(f"🔍 Recherche de l'option genre: '{gender_value}'...")
        gender_option = dropdown_popup.find_element(
            By.XPATH, f".//div[contains(@class,'mud-list-item')][.//p[normalize-space(text())='{gender_value}']]"
        )

        print(f"✅ Clic sur l'option genre: {gender_value}")
        gender_option.click()
        print(f"✅ Genre '{gender_value}' sélectionné avec succès")
        return True
    except Exception as e:
        print(f"❌ Échec de sélection du genre '{gender_value}': {e}")
        return False


def fill_input_fields(driver, wait, field_mapping):
    """Remplit les champs input basés sur le mapping fourni."""
    filled_labels = set()
    inputs = driver.find_elements(By.XPATH, "//input")
    
    for el in inputs:
        try:
            input_id = el.get_attribute("id")
            if input_id:
                label_elements = driver.find_elements(By.XPATH, f"//label[@for='{input_id}']")
                if label_elements:
                    label_text = label_elements[0].text.strip()
                    if label_text in field_mapping and label_text not in filled_labels:
                        value = field_mapping[label_text]
                        if value:  # Ne remplit que si la valeur n'est pas vide
                            el.clear()
                            el.send_keys(str(value))
                            filled_labels.add(label_text)
                            print(f"✅ Rempli '{label_text}' avec '{value}'")
                        else:
                            print(f"⚠️ Champ '{label_text}' laissé vide (pas de données)")
        except Exception as e:
            print(f"⚠️ Erreur lors du remplissage d'un champ: {e}")


def main():
    """Fonction principale du script."""
    print("🚀 Démarrage de l'automatisation IOL Calculator")
    
    # Configuration
    JSON_FILE = "exported_iol_data.json"
    HEADLESS = False  # Changez à True pour mode sans interface
    DEBUG = True
    
    # Vérification de l'existence du fichier JSON
    if not os.path.exists(JSON_FILE):
        print(f"❌ Fichier {JSON_FILE} non trouvé dans le répertoire courant")
        print("   Assurez-vous d'avoir exporté les données depuis l'application IOL Calculator")
        return
    
    # Chargement des données
    data = load_iol_data(JSON_FILE)
    if not data:
        print("❌ Impossible de charger les données IOL")
        return
    
    # Configuration du driver
    driver = setup_driver(headless=HEADLESS, debug=DEBUG)
    wait = WebDriverWait(driver, 10)
    
    try:
        print("🌐 Ouverture du site ESCRS IOL Calculator...")
        driver.get("https://iolcalculator.escrs.org/")

        print("✅ Acceptation des conditions...")
        agree_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[.//span[text()='I Agree']]")))
        agree_button.click()
        time.sleep(1)

        # Sélection du genre
        gender = data.get('gender', 'Female')
        select_gender(driver, wait, gender)
        time.sleep(1)

        # Préparation des données pour les champs du haut
        top_fields = {
            "Surgeon": data.get('surgeon', ''),
            "Patient Initials": data.get('patientInitials', ''),
            "Id": data.get('patientId', ''),
            "Age": data.get('age', ''),
        }

        print("✏️ Remplissage des champs du haut...")
        fill_input_fields(driver, wait, top_fields)

        # Préparation des données IOL pour l'œil gauche (Left Eye)
        # Note: Le site utilise "Left Eye" pour les données mais nous utilisons rightEye des données IOL
        iol_data = data.get('iolData', {})
        right_eye = iol_data.get('rightEye', {})
        
        # Mapping des champs IOL
        iol_fields = {
            "AL": extract_first_value(right_eye.get('AL', '')),
            "ACD": extract_first_value(right_eye.get('ACD', '')),
            "LT": extract_first_value(right_eye.get('LT', '')),
            "CCT": extract_first_value(right_eye.get('CCT', '')),
            "CD (WTW)": extract_first_value(right_eye.get('WTW', '')),
            "K1": extract_first_value(right_eye.get('K1', '')),
            "K2": extract_first_value(right_eye.get('K2', '')),
        }

        print("✏️ Remplissage des champs IOL...")
        print(f"📊 Données à saisir: {iol_fields}")
        fill_input_fields(driver, wait, iol_fields)

        # Sortir du dernier champ pour déclencher les calculs
        print("🖱️ Clic ailleurs pour déclencher blur sur le dernier champ...")
        body = driver.find_element(By.TAG_NAME, "body")
        body.click()

        # Attente avant calcul
        print("⏳ Attente de 2 secondes avant de cliquer sur 'Calculate'...")
        time.sleep(2)

        # Tentative de clic sur Calculate
        try:
            calc_button = driver.find_element(By.XPATH, "//button[.//span[contains(text(),'Calculate')]]")
            driver.execute_script("arguments[0].click();", calc_button)
            print("🧮 Clic sur 'Calculate' effectué")
        except Exception as e:
            print(f"❌ Échec du clic sur 'Calculate': {e}")

        print("⏳ Attente de 10 secondes pour le chargement du résultat...")
        time.sleep(10)

        # Capture d'écran
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"iol_result_{timestamp}.png"
        driver.save_screenshot(screenshot_path)
        print(f"📸 Capture d'écran sauvegardée: {screenshot_path}")

        print("✅ Automatisation terminée avec succès!")

    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        # Capture d'écran en cas d'erreur
        error_screenshot = f"error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        try:
            driver.save_screenshot(error_screenshot)
            print(f"📸 Capture d'écran d'erreur: {error_screenshot}")
        except:
            pass

    finally:
        if not DEBUG:
            driver.quit()
        else:
            print("🔍 Mode debug activé - le navigateur reste ouvert")
            input("Appuyez sur Entrée pour fermer le navigateur...")
            driver.quit()


if __name__ == "__main__":
    main()