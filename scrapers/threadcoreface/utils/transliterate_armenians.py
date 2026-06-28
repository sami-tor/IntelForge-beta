import pymysql
import re

# ------------------------------
# MySQL CONFIG
# ------------------------------
MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "madnaro"
MYSQL_PASSWORD = "9a33bm2aK!"
MYSQL_DATABASE = "dataset"

# ------------------------------
# Custom Armenian → English Mapping (ISO9985 → MFA)
# ------------------------------
ARM_MAP = {
    "ա": "a", "բ": "b", "գ": "g", "դ": "d",
    "ե": "e", "զ": "z", "ը": "y", "թ": "t",
    "ժ": "zh", "ի": "i", "լ": "l", "խ": "kh",
    "ծ": "ts", "կ": "k", "հ": "h", "ձ": "dz",
    "ղ": "gh", "ճ": "ch", "մ": "m", "յ": "y",
    "ն": "n", "շ": "sh", "ո": "o", "չ": "ch",
    "պ": "p", "ջ": "j", "ռ": "r", "ս": "s",
    "վ": "v", "տ": "t", "ր": "r", "ց": "ts",
    "ւ": "v", "փ": "p", "ք": "k", "օ": "o",
    "ֆ": "f", "և": "ev",

    # Uppercase
    "Ա": "A", "Բ": "B", "Գ": "G", "Դ": "D",
    "Ե": "E", "Զ": "Z", "Ը": "Y", "Թ": "T",
    "Ժ": "Zh", "Ի": "I", "Լ": "L", "Խ": "Kh",
    "Ծ": "Ts", "Կ": "K", "Հ": "H", "Ձ": "Dz",
    "Ղ": "Gh", "Ճ": "Ch", "Մ": "M", "Յ": "Y",
    "Ն": "N", "Շ": "Sh", "Ո": "O", "Չ": "Ch",
    "Պ": "P", "Ջ": "J", "Ռ": "R", "Ս": "S",
    "Վ": "V", "Տ": "T", "Ր": "R", "Ց": "Ts",
    "Ւ": "V", "Փ": "P", "Ք": "K", "Օ": "O",
    "Ֆ": "F", "և": "Ev",
}

def transliterate(text):
    result = ""
    for ch in text:
        result += ARM_MAP.get(ch, ch)
    # clean multi-spaces
    result = re.sub(r"\s+", " ", result)
    return result.strip()


# ------------------------------
# MAIN SCRIPT
# ------------------------------
def main():
    conn = pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        port=MYSQL_PORT,
        charset="utf8mb4"
    )

    cursor = conn.cursor()

    print("✓ Connected to MySQL")

    # Create new table
    cursor.execute("DROP TABLE IF EXISTS armenians_en")
    cursor.execute("""
        CREATE TABLE armenians_en (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name_en VARCHAR(255)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)
    print("✓ Table armenians_en created")

    # Read armenian names
    cursor.execute("SELECT full_name FROM armenians")
    rows = cursor.fetchall()
    total = len(rows)
    print(f"✓ Loaded {total} Armenian names")

    # Insert transliterated names
    batch = []
    for idx, (full_name,) in enumerate(rows, start=1):
        full_name_en = transliterate(full_name)
        batch.append((full_name_en,))

        # Batch insert per 5000 rows
        if len(batch) >= 5000:
            cursor.executemany("INSERT INTO armenians_en (full_name_en) VALUES (%s)", batch)
            conn.commit()
            batch = []
            print(f"→ {idx}/{total} processed")

    # Insert remaining
    if batch:
        cursor.executemany("INSERT INTO armenians_en (full_name_en) VALUES (%s)", batch)
        conn.commit()

    print("🎉 COMPLETED — all names transliterated and saved to armenians_en")


if __name__ == "__main__":
    main()
