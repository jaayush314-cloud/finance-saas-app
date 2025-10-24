// Authentication and Authorization System
// Handles user login, role-based access control, and session management

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.sessionKey = 'financeAppSession';
        this.init();
    }

    async init() {
        // Check if there's an existing session
        const session = this.getSession();
        if (session) {
            this.currentUser = session;
        }

        // Create default Master Admin if no users exist
        await this.createDefaultMasterAdmin();
    }

    // Create default Master Admin user
    async createDefaultMasterAdmin() {
        try {
            const users = await financeDB.getAll('users');
            
            // Check if Master Admin already exists
            const masterAdminExists = users.some(user => user.role === 'masterAdmin');
            
            if (!masterAdminExists) {
                const masterAdmin = {
                    id: this.generateId(),
                    username: 'superadmin',
                    password: this.hashPassword('admin@123'), // Default password
                    role: 'masterAdmin',
                    email: 'admin@financesaas.com',
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                    active: true
                };
                
                await financeDB.add('users', masterAdmin);
                console.log('Default Master Admin created: superadmin / admin@123');
            }
        } catch (error) {
            console.error('Error creating Master Admin:', error);
        }
    }

    // Login function
    async login(username, password) {
        try {
            const users = await financeDB.getAll('users');
            const hashedPassword = this.hashPassword(password);
            
            const user = users.find(u => 
                u.username === username && 
                u.password === hashedPassword &&
                u.active === true
            );
            
            if (user) {
                // Update last login
                user.lastLogin = new Date().toISOString();
                await financeDB.update('users', user.id, user);
                
                // Create session
                const sessionData = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email,
                    financerId: user.financerId || null, // For financer and employee roles
                    loginTime: new Date().toISOString()
                };
                
                this.currentUser = sessionData;
                this.saveSession(sessionData);
                
                // Set current user in database for audit logging
                financeDB.setCurrentUser(sessionData);
                
                return {
                    success: true,
                    user: sessionData,
                    message: 'Login successful'
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid username or password'
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Login failed. Please try again.'
            };
        }
    }

    // Logout function
    logout() {
        this.currentUser = null;
        this.clearSession();
        financeDB.setCurrentUser(null);
        window.location.href = 'index.html';
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check user role
    hasRole(role) {
        if (!this.currentUser) return false;
        if (Array.isArray(role)) {
            return role.includes(this.currentUser.role);
        }
        return this.currentUser.role === role;
    }

    // Permission checks
    canAccessMasterAdmin() {
        return this.hasRole('masterAdmin');
    }

    canAccessFinancerDashboard() {
        return this.hasRole(['masterAdmin', 'financer']);
    }

    canAccessEmployeeDashboard() {
        return this.hasRole(['masterAdmin', 'financer', 'employee']);
    }

    // Check if user can manage customers
    canManageCustomers() {
        return this.hasRole(['masterAdmin', 'financer']);
    }

    // Check if user can view all data (Master Admin or own data)
    canViewAllData() {
        return this.hasRole('masterAdmin');
    }

    // Check if user can export data
    canExportData() {
        return this.hasRole(['masterAdmin', 'financer']);
    }

    // Check if user can manage team
    canManageTeam() {
        return this.hasRole(['masterAdmin', 'financer']);
    }

    // Check if user can access reports
    canAccessReports() {
        return this.hasRole(['masterAdmin', 'financer']);
    }

    // Session management
    saveSession(sessionData) {
        localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    }

    getSession() {
        const session = localStorage.getItem(this.sessionKey);
        return session ? JSON.parse(session) : null;
    }

    clearSession() {
        localStorage.removeItem(this.sessionKey);
    }

    // Password hashing (simple hash - in production use bcrypt or similar)
    hashPassword(password) {
        // Simple hash function for demo
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Create new user (for Financer or Employee)
    async createUser(userData) {
        try {
            // Validate permissions
            if (!this.canManageTeam()) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            // Check if username already exists
            const users = await financeDB.getAll('users');
            const usernameExists = users.some(u => u.username === userData.username);
            
            if (usernameExists) {
                return {
                    success: false,
                    message: 'Username already exists'
                };
            }

            const newUser = {
                id: this.generateId(),
                username: userData.username,
                password: this.hashPassword(userData.password),
                role: userData.role, // 'financer' or 'employee'
                email: userData.email,
                financerId: userData.role === 'financer' ? null : userData.financerId,
                permissions: userData.permissions || [],
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser.id,
                lastLogin: null,
                active: true
            };

            await financeDB.add('users', newUser);
            
            return {
                success: true,
                user: newUser,
                message: 'User created successfully'
            };
        } catch (error) {
            console.error('Error creating user:', error);
            return {
                success: false,
                message: 'Failed to create user'
            };
        }
    }

    // Update user
    async updateUser(userId, updates) {
        try {
            if (!this.canManageTeam()) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            // If password is being updated, hash it
            if (updates.password) {
                updates.password = this.hashPassword(updates.password);
            }

            await financeDB.update('users', userId, updates);
            
            return {
                success: true,
                message: 'User updated successfully'
            };
        } catch (error) {
            console.error('Error updating user:', error);
            return {
                success: false,
                message: 'Failed to update user'
            };
        }
    }

    // Delete/Deactivate user
    async deleteUser(userId) {
        try {
            if (!this.canManageTeam()) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            // Don't actually delete, just deactivate
            await financeDB.update('users', userId, { active: false });
            
            return {
                success: true,
                message: 'User deactivated successfully'
            };
        } catch (error) {
            console.error('Error deleting user:', error);
            return {
                success: false,
                message: 'Failed to delete user'
            };
        }
    }

    // Redirect user to appropriate dashboard based on role
    redirectToDashboard() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }

        const role = this.currentUser.role;
        
        switch(role) {
            case 'masterAdmin':
                window.location.href = 'master-admin.html';
                break;
            case 'financer':
                window.location.href = 'financer.html';
                break;
            case 'employee':
                window.location.href = 'employee.html';
                break;
            default:
                console.error('Unknown role:', role);
                this.logout();
        }
    }

    // Protect page - redirect if not authenticated or wrong role
    protectPage(allowedRoles) {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }

        if (allowedRoles && !this.hasRole(allowedRoles)) {
            // User doesn't have permission for this page
            console.warn('Access denied. Redirecting to appropriate dashboard.');
            this.redirectToDashboard();
            return false;
        }

        return true;
    }

    // Get all users (for team management)
    async getAllUsers() {
        try {
            if (!this.canManageTeam() && !this.canViewAllData()) {
                return [];
            }

            const users = await financeDB.getAll('users');
            
            // Master Admin can see all users
            if (this.canViewAllData()) {
                return users;
            }
            
            // Financer can only see their own employees
            return users.filter(u => 
                u.financerId === this.currentUser.id || 
                u.id === this.currentUser.id
            );
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    // Get user statistics
    async getUserStats() {
        try {
            const users = await financeDB.getAll('users');
            
            return {
                total: users.length,
                masterAdmins: users.filter(u => u.role === 'masterAdmin').length,
                financers: users.filter(u => u.role === 'financer').length,
                employees: users.filter(u => u.role === 'employee').length,
                active: users.filter(u => u.active).length,
                inactive: users.filter(u => !u.active).length
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }
}

// Export singleton instance
const authSystem = new AuthSystem();

// Make it available globally
if (typeof window !== 'undefined') {
    window.authSystem = authSystem;
}
