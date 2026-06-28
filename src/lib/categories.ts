/**
 * Data Categories Configuration
 * Defines available data categories and access levels
 */

export interface Category {
  id: string
  label: string
  path: string
  pro: boolean
  description: string
}

export const CATEGORIES: Category[] = [
  // PUBLIC/FREE CATEGORIES
  {
    id: "stealer_logs",
    label: "Stealer Logs",
    path: "SteaterLogs",
    pro: true,
    description: "Stealer malware logs with sensitive data"
  },
  {
    id: "stealer_logs_1",
    label: "Stealer Logs (Additional)",
    path: "SteaterLogs1",
    pro: true,
    description: "Additional stealer logs collection"
  },
  {
    id: "leak_ulp",
    label: "ULP (User/Login/Password Leaks)",
    path: "LeakULP",
    pro: false,
    description: "User credentials and login data"
  },
  {
    id: "leak_ulp_2",
    label: "ULP 2",
    path: "LeakULP2",
    pro: true,
    description: "Additional user credentials"
  },
  {
    id: "combos",
    label: "Combos",
    path: "Combos",
    pro: true,
    description: "Combined credential pairs"
  },
  {
    id: "pastes",
    label: "Pastes",
    path: "Pastes",
    pro: true,
    description: "Data from paste websites"
  },
  // CSV/DATABASE
  {
    id: "csv_files",
    label: "CSV Files",
    path: "CSVFiles",
    pro: false,
    description: "Comma-separated data files"
  },
  {
    id: "sql_data",
    label: "SQL Data",
    path: "SQLData1",
    pro: true,
    description: "SQL database dumps"
  },
  // OTHER
  {
    id: "subdomains",
    label: "Subdomains",
    path: "Subdomains",
    pro: false,
    description: "Subdomain lists"
  },
  {
    id: "countries",
    label: "Countries",
    path: "Countries",
    pro: false,
    description: "Country-specific data"
  },
  {
    id: "random_raw",
    label: "Random Raw Data",
    path: "RandomRawData",
    pro: false,
    description: "Miscellaneous raw data"
  }
]

/**
 * Get categories accessible to user based on subscription
 */
export function getAccessibleCategories(userType: string): Category[] {
  if (userType === "premium" || userType?.includes("analyst") || userType?.includes("hacker")) {
    return CATEGORIES
  }
  
  // Free users get public categories only
  return CATEGORIES.filter(cat => !cat.pro)
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(cat => cat.id === id)
}

/**
 * Get category by path
 */
export function getCategoryByPath(path: string): Category | undefined {
  return CATEGORIES.find(cat => cat.path === path)
}

/**
 * Check if user can access category
 */
export function canAccessCategory(categoryId: string, userType: string): boolean {
  const category = getCategoryById(categoryId)
  if (!category) return false
  
  if (!category.pro) return true
  
  return userType === "premium" || userType?.includes("analyst") || userType?.includes("hacker")
}
