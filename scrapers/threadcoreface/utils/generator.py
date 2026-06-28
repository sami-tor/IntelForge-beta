import csv

with open("armenian_numbers.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["number"])  # header
    for n in range(99000000, 100000000):
        writer.writerow([n])

print("Done! File: armenian_numbers.csv")
