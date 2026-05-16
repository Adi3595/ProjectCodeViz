#include "models.h"
#include "authService.h"
#include <iostream>
#include <string>

// @viz: Handles all user authentication workflows
class AuthService {
private:
    PostgresDatabase db; // @viz: Main database instance
    std::string jwtSecret;
    int maxAttempts;

public:
    AuthService(const std::string& secret); // @viz: Initialize with JWT signing secret

    // @viz: Authenticates user with username and password
    bool login(const std::string& username, const std::string& password) {
        User user = findUser(username);
        if (validateCredentials(user, password)) {
            return generateToken(user);
        }
        return false;
    }

    // @viz: Validates user credentials against database
    bool validateCredentials(const User& user, const std::string& password) {
        std::string hashedInput = hashPassword(password);
        return db.executeQuery("SELECT * FROM users WHERE hash='" + hashedInput + "'");
    }

    // @viz: Creates JWT token for authenticated session
    bool generateToken(const User& user) {
        std::string payload = user.getUsername() + ":" + std::to_string(user.userId);
        return encodeJwt(payload);
    }

    void logout(const std::string& token);

    bool resetPassword(const std::string& email); // @viz: Sends password reset email

private:
    User findUser(const std::string& username);
    std::string hashPassword(const std::string& password);
    bool encodeJwt(const std::string& payload);
};

// @viz: Manages user registration process
class RegistrationService {
private:
    AuthService* authSvc;
    PostgresDatabase db;

public:
    RegistrationService(AuthService* auth);

    // @viz: Registers a new user account
    bool registerUser(const std::string& username, const std::string& email, const std::string& password) {
        if (userExists(username)) {
            return false;
        }
        User newUser(0, username, email);
        return saveUser(newUser);
    }

    bool userExists(const std::string& username);
    bool saveUser(const User& user);
    bool sendWelcomeEmail(const std::string& email); // @viz: Sends onboarding email to new user
};
