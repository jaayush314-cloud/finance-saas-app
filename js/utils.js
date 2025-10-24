// Utility Functions for Finance SaaS Application

class Utils {
    static formatCurrency(amount) {
        if (isNaN(amount)) return 'Rs.0';
        return 'Rs.' + Number(amount).toLocaleString('en-IN');
    }

    static formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    static formatDateTime(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return this.formatDate(date) + ' ' + d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
    }

    static daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    static getDaysOverdue(dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        if (due >= today) return 0;
        return this.daysBetween(due, today);
    }

    static calculateNextDueDate(lastDueDate, frequency = 'monthly') {
        const date = new Date(lastDueDate);
        if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
        return date.toISOString().split('T')[0];
    }

    static validateVehicleNumber(vehicleNumber) {
        const cleaned = vehicleNumber.toUpperCase().replace(/\s+/g, '');
        return cleaned.length >= 6;
    }

    static formatVehicleNumber(vehicleNumber) {
        return vehicleNumber.toUpperCase().replace(/\s+/g, '');
    }

    static validatePhoneNumber(phone) {
        const cleaned = phone.replace(/[\s-]/g, '');
        return cleaned.length === 10 && /^[6-9]/.test(cleaned);
    }

    static formatPhoneNumber(phone) {
        const cleaned = phone.replace(/[\s-]/g, '');
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
        }
        return cleaned;
    }

    static validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static getCustomerStatus(daysOverdue) {
        if (daysOverdue === 0) return { label: 'Good', class: 'badge-success' };
        if (daysOverdue <= 7) return { label: 'Watch', class: 'badge-warning' };
        if (daysOverdue <= 30) return { label: 'Risk', class: 'badge-danger' };
        return { label: 'Critical', class: 'badge-critical' };
    }

    static sanitize(input) {
        if (typeof input !== 'string') return input;
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = [headers.join(','), ...data.map(row => headers.map(h => row[h]).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `position:fixed;top:20px;right:20px;padding:1rem;background:${type==='success'?'#10b981':type==='error'?'#ef4444':'#3b82f6'};color:white;border-radius:8px;z-index:10000`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    static async confirm(message) {
        return window.confirm(message);
    }

    static async getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject(new Error('Not supported'));
            navigator.geolocation.getCurrentPosition(
                pos => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude}),
                err => reject(err)
            );
        });
    }

    static calculateEMI(principal, ratePercent, months) {
        const rate = ratePercent / 12 / 100;
        if (rate === 0) return principal / months;
        return Math.round((principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1));
    }

    static search(array, searchTerm, fields) {
        if (!searchTerm) return array;
        const term = searchTerm.toLowerCase();
        return array.filter(item => fields.some(field => item[field] && item[field].toString().toLowerCase().includes(term)));
    }

    static sortBy(array, field, order = 'asc') {
        return array.sort((a, b) => order === 'asc' ? (a[field] > b[field] ? 1 : -1) : (a[field] < b[field] ? 1 : -1));
    }

    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
}
