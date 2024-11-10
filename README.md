This plugin only works with:

- payload 3.0.0-beta
- mongodb
- any cloud storage adapter (does not support local file storage)

&nbsp;

# Why this plugin?

### Scenario #1
You're working with a production database that is getting frequently updated and you want to push a feature that requires code + database changes.

#### Option #1
Quickly clone the database to your local machine, make the data changes and then overwrite the production database with your local database.

Pros
- It works (maybe)

Cons
- Depending on how frequently the database (i.e. website) is updated, you might lose some data changes (e.g. e-commerce orders, form submissions, content entry changes from the client or other developers, etc) made to the production database in the time it took you to do all that.

#### Option #2

Make the code (i.e. field structure) changes on your local machine then use this plugin to switch the database connection to your production database to make data/content updates.

Pros:

- Never lose any business-as-usual updates made to your production database
- You can have the data component of a feature requiring code + data primed and ready in the production database, so that when the code is eventually deployed, the code can assume that the data exists in the database
- You could change your db connection string environment variable, but pressing a button in the admin dashboard is quicker and less prone to error

Cons:

- You have to train all developers on a project using this plugin to be careful when in "production environment" mode.


### Scenario #2

You want to replicate the production environment to your development environment as quickly and simply as possible.

#### Option #1

Do a manual database dump and restore on your local machine. Make a copy of all the upload collection files on your local machine or in the cloud somehow.

Pros
- It works

Cons
- Depending on your setup, can be confusing/time consuming for new developers


#### Option #2

Use this plugin to quickly copy your production database to local, with all the upload collection documents still referencing the files in your production cloud storage 

Pros

- Copy production environment to development environment at the press of a button
- Your production cloud storage files are safe because this plugin prevents you from updating/deleting upload collection documents that were NOT created during development
- Images/files don't have to be synced/copied to your local machine

Cons

- The plugin does not currently work for production environments using local file storage (although it may be possible to add this as a feature in the future)

