/**
 * CUSTOMER MANAGEMENT MODULE
 * Handles customer data, vehicle information, and loan management
 * Features: Create, Read, Update, Delete customers with encrypted storage
 * Multi-tenant support with role-based access control
 * Author: Finance Platform Team
 * Version: 1.0.0
 */

class CustomerManager {
    constructor() {
        this.currentUser = null;
        this.isReady = false;
        this.readyPromise = this.init();
    }

    async init() {
        // Wait for auth system to be ready
        if (typeof authSystem !== 'undefined') {
            await authSystem.waitForReady();
            this.currentUser = authSystem.getCurrentUser();
        }
        this.isReady = true;
        return true;
    }

    async waitForReady() {
        if (this.isReady) return true;
        await this.readyPromise;
        return true;
    }

    // Create new customer
    async createCustomer(customerData) {
        try {
            await this.waitForReady();

            // Validate permissions
            if (!authSystem.canManageCustomers()) {
                return {
                    success: false,
                    message: 'Permission denied. Only Master Admin and Financers can manage customers.'
                };
            }

            // Validate required fields
            const validation = this.validateCustomerData(customerData);
            if (!validation.valid) {
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Check if customer already exists (by phone or Aadhar)
            const existingCustomer = await this.findExistingCustomer(
                customerData.phone, 
                customerData.aadharNumber
            );

            if (existingCustomer) {
                return {
                    success: false,
                    message: 'Customer already exists with this phone number or Aadhar card.'
                };
            }

            const customer = {
                id: this.generateId(),
                // Personal Information
                name: customerData.name,
                phone: customerData.phone,
                email: customerData.email || null,
                aadharNumber: customerData.aadharNumber,
                panNumber: customerData.panNumber || null,
                address: {
                    street: customerData.address.street,
                    city: customerData.address.city,
                    state: customerData.address.state,
                    pincode: customerData.address.pincode,
                    landmark: customerData.address.landmark || null
                },
                // Vehicle Information
                vehicle: {
                    make: customerData.vehicle.make,
                    model: customerData.vehicle.model,
                    year: customerData.vehicle.year,
                    registrationNumber: customerData.vehicle.registrationNumber,
                    engineNumber: customerData.vehicle.engineNumber,
                    chassisNumber: customerData.vehicle.chassisNumber,
                    color: customerData.vehicle.color,
                    fuelType: customerData.vehicle.fuelType,
                    vehicleType: customerData.vehicle.vehicleType // Two-wheeler, Four-wheeler, etc.
                },
                // Loan Information
                loan: {
                    amount: customerData.loan.amount,
                    interestRate: customerData.loan.interestRate,
                    tenure: customerData.loan.tenure, // in months
                    emi: customerData.loan.emi,
                    startDate: customerData.loan.startDate,
                    endDate: customerData.loan.endDate,
                    status: 'active', // active, completed, defaulted, seized
                    guarantor: customerData.loan.guarantor || null
                },
                // Financial Tracking
                payments: {
                    totalPaid: 0,
                    totalDue: customerData.loan.amount,
                    lastPaymentDate: null,
                    nextDueDate: customerData.loan.startDate,
                    overdueAmount: 0,
                    overdueCount: 0
                },
                // Multi-tenant support
                financerId: this.currentUser.role === 'financer' ? 
                    this.currentUser.id : 
                    (this.currentUser.financerId || customerData.financerId),
                // Metadata
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser.id,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser.id,
                status: 'active', // active, inactive, blacklisted
                tags: customerData.tags || [],
                notes: customerData.notes || ''
            };

            // Add customer to database
            await financeDB.add('customers', customer);

            // Log audit trail
            await this.logActivity('customer_created', customer.id, {
                customerName: customer.name,
                vehicleNumber: customer.vehicle.registrationNumber,
                loanAmount: customer.loan.amount
            });

            return {
                success: true,
                customer: customer,
                message: 'Customer created successfully'
            };

        } catch (error) {
            console.error('Error creating customer:', error);
            return {
                success: false,
                message: 'Failed to create customer. Please try again.'
            };
        }
    }

    // Get all customers (with role-based filtering)
    async getAllCustomers(filters = {}) {
        try {
            await this.waitForReady();

            let customers = await financeDB.getAll('customers');

            // Apply role-based filtering
            customers = this.applyRoleBasedFilter(customers);

            // Apply search filters
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                customers = customers.filter(customer => 
                    customer.name.toLowerCase().includes(searchTerm) ||
                    customer.phone.includes(searchTerm) ||
                    customer.vehicle.registrationNumber.toLowerCase().includes(searchTerm)
                );
            }

            // Apply status filter
            if (filters.status) {
                customers = customers.filter(customer => customer.status === filters.status);
            }

            // Apply loan status filter
            if (filters.loanStatus) {
                customers = customers.filter(customer => customer.loan.status === filters.loanStatus);
            }

            // Apply overdue filter
            if (filters.overdue) {
                customers = customers.filter(customer => customer.payments.overdueAmount > 0);
            }

            // Sort by specified field
            const sortBy = filters.sortBy || 'createdAt';
            const sortOrder = filters.sortOrder || 'desc';
            
            customers.sort((a, b) => {
                let aValue = this.getNestedValue(a, sortBy);
                let bValue = this.getNestedValue(b, sortBy);
                
                if (sortOrder === 'desc') {
                    return bValue > aValue ? 1 : -1;
                } else {
                    return aValue > bValue ? 1 : -1;
                }
            });

            return {
                success: true,
                customers: customers,
                total: customers.length
            };

        } catch (error) {
            console.error('Error getting customers:', error);
            return {
                success: false,
                message: 'Failed to load customers'
            };
        }
    }

    // Get customer by ID
    async getCustomer(customerId) {
        try {
            await this.waitForReady();

            const customer = await financeDB.get('customers', customerId);
            
            if (!customer) {
                return {
                    success: false,
                    message: 'Customer not found'
                };
            }

            // Check permission to view this customer
            if (!this.canAccessCustomer(customer)) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            return {
                success: true,
                customer: customer
            };

        } catch (error) {
            console.error('Error getting customer:', error);
            return {
                success: false,
                message: 'Failed to load customer'
            };
        }
    }

    // Update customer
    async updateCustomer(customerId, updates) {
        try {
            await this.waitForReady();

            const customer = await financeDB.get('customers', customerId);
            
            if (!customer) {
                return {
                    success: false,
                    message: 'Customer not found'
                };
            }

            // Check permission
            if (!this.canAccessCustomer(customer) || !authSystem.canManageCustomers()) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            // Merge updates
            const updatedCustomer = {
                ...customer,
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser.id
            };

            // Validate updated data
            if (updates.phone || updates.aadharNumber) {
                const validation = this.validateCustomerData(updatedCustomer);
                if (!validation.valid) {
                    return {
                        success: false,
                        message: validation.message
                    };
                }
            }

            await financeDB.update('customers', customerId, updatedCustomer);

            // Log audit trail
            await this.logActivity('customer_updated', customerId, {
                changes: Object.keys(updates),
                customerName: updatedCustomer.name
            });

            return {
                success: true,
                customer: updatedCustomer,
                message: 'Customer updated successfully'
            };

        } catch (error) {
            console.error('Error updating customer:', error);
            return {
                success: false,
                message: 'Failed to update customer'
            };
        }
    }

    // Delete customer (soft delete)
    async deleteCustomer(customerId) {
        try {
            await this.waitForReady();

            const customer = await financeDB.get('customers', customerId);
            
            if (!customer) {
                return {
                    success: false,
                    message: 'Customer not found'
                };
            }

            // Check permission
            if (!this.canAccessCustomer(customer) || !authSystem.canManageCustomers()) {
                return {
                    success: false,
                    message: 'Permission denied'
                };
            }

            // Soft delete - mark as inactive
            const updatedCustomer = {
                ...customer,
                status: 'inactive',
                deletedAt: new Date().toISOString(),
                deletedBy: this.currentUser.id,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser.id
            };

            await financeDB.update('customers', customerId, updatedCustomer);

            // Log audit trail
            await this.logActivity('customer_deleted', customerId, {
                customerName: customer.name,
                vehicleNumber: customer.vehicle.registrationNumber
            });

            return {
                success: true,
                message: 'Customer deleted successfully'
            };

        } catch (error) {
            console.error('Error deleting customer:', error);
            return {
                success: false,
                message: 'Failed to delete customer'
            };
        }
    }

    // Search customers with advanced filters
    async searchCustomers(searchParams) {
        try {
            await this.waitForReady();

            const {
                query,
                vehicleNumber,
                phoneNumber,
                aadharNumber,
                loanStatus,
                overdueOnly,
                dateRange,
                amountRange
            } = searchParams;

            let customers = await financeDB.getAll('customers');
            customers = this.applyRoleBasedFilter(customers);

            // Text search across multiple fields
            if (query) {
                const searchTerm = query.toLowerCase();
                customers = customers.filter(customer => 
                    customer.name.toLowerCase().includes(searchTerm) ||
                    customer.phone.includes(searchTerm) ||
                    customer.email?.toLowerCase().includes(searchTerm) ||
                    customer.vehicle.registrationNumber.toLowerCase().includes(searchTerm) ||
                    customer.vehicle.make.toLowerCase().includes(searchTerm) ||
                    customer.vehicle.model.toLowerCase().includes(searchTerm)
                );
            }

            // Specific field searches
            if (vehicleNumber) {
                customers = customers.filter(customer => 
                    customer.vehicle.registrationNumber.toLowerCase().includes(vehicleNumber.toLowerCase())
                );
            }

            if (phoneNumber) {
                customers = customers.filter(customer => 
                    customer.phone.includes(phoneNumber)
                );
            }

            if (aadharNumber) {
                customers = customers.filter(customer => 
                    customer.aadharNumber.includes(aadharNumber)
                );
            }

            if (loanStatus) {
                customers = customers.filter(customer => 
                    customer.loan.status === loanStatus
                );
            }

            if (overdueOnly) {
                customers = customers.filter(customer => 
                    customer.payments.overdueAmount > 0
                );
            }

            // Date range filter
            if (dateRange && dateRange.start && dateRange.end) {
                customers = customers.filter(customer => {
                    const customerDate = new Date(customer.createdAt);
                    const startDate = new Date(dateRange.start);
                    const endDate = new Date(dateRange.end);
                    return customerDate >= startDate && customerDate <= endDate;
                });
            }

            // Loan amount range filter
            if (amountRange && (amountRange.min || amountRange.max)) {
                customers = customers.filter(customer => {
                    const amount = customer.loan.amount;
                    const min = amountRange.min || 0;
                    const max = amountRange.max || Infinity;
                    return amount >= min && amount <= max;
                });
            }

            return {
                success: true,
                customers: customers,
                total: customers.length
            };

        } catch (error) {
            console.error('Error searching customers:', error);
            return {
                success: false,
                message: 'Search failed'
            };
        }
    }

    // Get customer statistics
    async getCustomerStats() {
        try {
            await this.waitForReady();

            let customers = await financeDB.getAll('customers');
            customers = this.applyRoleBasedFilter(customers);

            const stats = {
                total: customers.length,
                active: customers.filter(c => c.status === 'active').length,
                inactive: customers.filter(c => c.status === 'inactive').length,
                blacklisted: customers.filter(c => c.status === 'blacklisted').length,
                
                loanStatus: {
                    active: customers.filter(c => c.loan.status === 'active').length,
                    completed: customers.filter(c => c.loan.status === 'completed').length,
                    defaulted: customers.filter(c => c.loan.status === 'defaulted').length,
                    seized: customers.filter(c => c.loan.status === 'seized').length
                },
                
                overdue: {
                    count: customers.filter(c => c.payments.overdueAmount > 0).length,
                    totalAmount: customers.reduce((sum, c) => sum + c.payments.overdueAmount, 0)
                },
                
                totalLoanAmount: customers.reduce((sum, c) => sum + c.loan.amount, 0),
                totalOutstanding: customers.reduce((sum, c) => sum + c.payments.totalDue, 0),
                totalCollected: customers.reduce((sum, c) => sum + c.payments.totalPaid, 0),
                
                vehicleTypes: this.getVehicleTypeStats(customers),
                recentCustomers: customers
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5)
            };

            return {
                success: true,
                stats: stats
            };

        } catch (error) {
            console.error('Error getting customer stats:', error);
            return {
                success: false,
                message: 'Failed to load statistics'
            };
        }
    }

    // Validation methods
    validateCustomerData(customerData) {
        const errors = [];

        // Required fields validation
        if (!customerData.name || customerData.name.trim().length < 2) {
            errors.push('Customer name is required and must be at least 2 characters');
        }

        if (!customerData.phone || !/^[6-9]\d{9}$/.test(customerData.phone)) {
            errors.push('Valid 10-digit Indian mobile number is required');
        }

        if (!customerData.aadharNumber || !/^\d{12}$/.test(customerData.aadharNumber)) {
            errors.push('Valid 12-digit Aadhar number is required');
        }

        // Address validation
        if (!customerData.address || !customerData.address.city || !customerData.address.state) {
            errors.push('Address with city and state is required');
        }

        // Vehicle validation
        if (!customerData.vehicle || !customerData.vehicle.registrationNumber) {
            errors.push('Vehicle registration number is required');
        }

        if (!customerData.vehicle || !customerData.vehicle.make || !customerData.vehicle.model) {
            errors.push('Vehicle make and model are required');
        }

        // Loan validation
        if (!customerData.loan || !customerData.loan.amount || customerData.loan.amount <= 0) {
            errors.push('Valid loan amount is required');
        }

        if (!customerData.loan || !customerData.loan.interestRate || customerData.loan.interestRate <= 0) {
            errors.push('Valid interest rate is required');
        }

        if (!customerData.loan || !customerData.loan.tenure || customerData.loan.tenure <= 0) {
            errors.push('Valid loan tenure is required');
        }

        return {
            valid: errors.length === 0,
            message: errors.join(', ')
        };
    }

    // Helper methods
    async findExistingCustomer(phone, aadharNumber) {
        try {
            const customers = await financeDB.getAll('customers');
            return customers.find(customer => 
                customer.phone === phone || 
                customer.aadharNumber === aadharNumber
            );
        } catch (error) {
            console.error('Error finding existing customer:', error);
            return null;
        }
    }

    applyRoleBasedFilter(customers) {
        if (!this.currentUser) return [];

        // Master Admin can see all customers
        if (this.currentUser.role === 'masterAdmin') {
            return customers;
        }

        // Financer can see their own customers
        if (this.currentUser.role === 'financer') {
            return customers.filter(customer => 
                customer.financerId === this.currentUser.id
            );
        }

        // Employee can see customers of their financer
        if (this.currentUser.role === 'employee') {
            return customers.filter(customer => 
                customer.financerId === this.currentUser.financerId
            );
        }

        return [];
    }

    canAccessCustomer(customer) {
        if (!this.currentUser) return false;

        // Master Admin can access all
        if (this.currentUser.role === 'masterAdmin') {
            return true;
        }

        // Financer can access their own customers
        if (this.currentUser.role === 'financer') {
            return customer.financerId === this.currentUser.id;
        }

        // Employee can access customers of their financer
        if (this.currentUser.role === 'employee') {
            return customer.financerId === this.currentUser.financerId;
        }

        return false;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    getVehicleTypeStats(customers) {
        const vehicleTypes = {};
        customers.forEach(customer => {
            const type = customer.vehicle.vehicleType || 'Unknown';
            vehicleTypes[type] = (vehicleTypes[type] || 0) + 1;
        });
        return vehicleTypes;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async logActivity(action, customerId, details) {
        try {
            if (typeof auditLogger !== 'undefined') {
                await auditLogger.log({
                    action: action,
                    entityType: 'customer',
                    entityId: customerId,
                    userId: this.currentUser?.id,
                    userName: this.currentUser?.username,
                    details: details,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    // Export customer data
    async exportCustomers(format = 'json', filters = {}) {
        try {
            await this.waitForReady();

            if (!authSystem.canExportData()) {
                return {
                    success: false,
                    message: 'Permission denied. Only Master Admin and Financers can export data.'
                };
            }

            const result = await this.getAllCustomers(filters);
            if (!result.success) {
                return result;
            }

            const customers = result.customers;

            if (format === 'csv') {
                const csvData = this.convertToCSV(customers);
                return {
                    success: true,
                    data: csvData,
                    filename: `customers-${new Date().toISOString().split('T')[0]}.csv`,
                    contentType: 'text/csv'
                };
            } else {
                return {
                    success: true,
                    data: JSON.stringify(customers, null, 2),
                    filename: `customers-${new Date().toISOString().split('T')[0]}.json`,
                    contentType: 'application/json'
                };
            }

        } catch (error) {
            console.error('Error exporting customers:', error);
            return {
                success: false,
                message: 'Export failed'
            };
        }
    }

    convertToCSV(customers) {
        if (customers.length === 0) return '';

        const headers = [
            'Name', 'Phone', 'Email', 'Aadhar Number', 'PAN Number',
            'Address', 'City', 'State', 'Pincode',
            'Vehicle Make', 'Vehicle Model', 'Registration Number',
            'Loan Amount', 'Interest Rate', 'Tenure (Months)', 'EMI',
            'Total Paid', 'Total Due', 'Overdue Amount',
            'Loan Status', 'Customer Status', 'Created Date'
        ];

        const csvRows = [headers.join(',')];

        customers.forEach(customer => {
            const row = [
                `"${customer.name}"`,
                customer.phone,
                `"${customer.email || ''}"`,
                customer.aadharNumber,
                `"${customer.panNumber || ''}"`,
                `"${customer.address.street || ''}"`,
                `"${customer.address.city}"`,
                `"${customer.address.state}"`,
                customer.address.pincode || '',
                `"${customer.vehicle.make}"`,
                `"${customer.vehicle.model}"`,
                `"${customer.vehicle.registrationNumber}"`,
                customer.loan.amount,
                customer.loan.interestRate,
                customer.loan.tenure,
                customer.loan.emi,
                customer.payments.totalPaid,
                customer.payments.totalDue,
                customer.payments.overdueAmount,
                customer.loan.status,
                customer.status,
                new Date(customer.createdAt).toLocaleDateString()
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }
}

// Create singleton instance
const customerManager = new CustomerManager();

// Make it globally available
if (typeof window !== 'undefined') {
    window.customerManager = customerManager;
}
