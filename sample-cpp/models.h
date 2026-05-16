#pragma once
#include <string>
#include <vector>

// @viz: Represents a user in the system
class User {
public:
    std::string username; // @viz: Unique login identifier
    std::string email;
    int userId;

    User(int id, std::string name, std::string mail);
    ~User();

    std::string getUsername() const; // @viz: Returns the user's display name
    bool isAdmin() const;
};

// @viz: Base interface for database connections
class IDatabase {
public:
    virtual bool connect(const std::string& connectionString) = 0; // @viz: Opens a database connection
    virtual void disconnect() = 0;
    virtual bool executeQuery(const std::string& query) = 0;
    virtual ~IDatabase() {}
};

// @viz: PostgreSQL database implementation
class PostgresDatabase : public IDatabase {
private:
    std::string connectionString;
    bool isConnected;

public:
    PostgresDatabase();
    bool connect(const std::string& connectionString) override; // @viz: Connects to PostgreSQL server
    void disconnect() override;
    bool executeQuery(const std::string& query) override;
    bool isActive() const;
};
