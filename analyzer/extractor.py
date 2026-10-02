import zipfile
import os
import shutil


def extract_extension(zip_path, output_folder="extracted_extension"):

    if os.path.exists(output_folder):
        shutil.rmtree(output_folder)

    os.makedirs(output_folder)

    with zipfile.ZipFile(zip_path, "r") as zip_file:
        zip_file.extractall(output_folder)

    return output_folder