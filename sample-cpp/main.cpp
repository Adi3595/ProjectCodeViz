#include "models.h"
#include "authService.h"
#include <iostream>

// @viz: Application entry point and configuration
int main() {
    // @viz: JWT secret from environment
    std::string secret = "my-jwt-secret";

    AuthService auth(secret); // @viz: Global auth service instance
    RegistrationService reg(&auth);

    // Demonstrate login flow
    bool result = auth.login("admin", "password123");
    if (result) {
        std::cout << "Login successful!" << std::endl;
    } else {
        std::cout << "Login failed." << std::endl;
    }

    // Register new user
    bool registered = reg.registerUser("newuser", "new@example.com", "securepass");
    if (registered) {
        std::cout << "Registration successful!" << std::endl;
    }

    return 0;
}

// @viz: Utility to print application version
void printVersion() {
    std::cout << "ProjectCodeWiz Sample App v1.0" << std::endl;
}

// @viz: Loads configuration from file
bool loadConfig(const std::string& configPath) {
    // Stub implementation
    return true;
}
