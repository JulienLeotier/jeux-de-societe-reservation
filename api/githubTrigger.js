const GITHUB_API_URL = "https://api.github.com/repos/JulienLeotier/jeux-de-societe-reservation/contents/db.json";

async function updateGithub(updatedContent) {
    const contentBase64 = Buffer.from(JSON.stringify(updatedContent)).toString('base64');
    
    // Obtenir le sha actuel du fichier pour la mise à jour
    let sha;
    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`
            }
        });
        const data = await response.json();
        sha = data.sha;
    } catch (error) {
        console.error("Erreur lors de la récupération du sha : ", error);
        return false;
    }

    // Pousser les modifications
    try {
        await fetch(GITHUB_API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Mise à jour db.json depuis l'API",
                content: contentBase64,
                sha: sha
            })
        });
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour : ", error);
        return false;
    }
}

module.exports = async (req, res) => {
    const data = req.body;

    // Obtenir le contenu actuel de db.json
    let dbContent;
    try {
        const response = await fetch('https://raw.githubusercontent.com/JulienLeotier/jeux-de-societe-reservation/master/db.json');
        dbContent = JSON.parse(response);
    } catch (error) {
        res.status(500).send('Failed to fetch db.json');
        return;
    }
    if(!data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid request body' })
      };
    }

    // Vérifier si c'est une mise à jour de jeux/date ou une réservation
    if (data.games && data.date) {
        // Mise à jour de jeux pour une date spécifique
        let dateEntry = dbContent.find(entry => entry.date === data.date);
        if (dateEntry) {
            dateEntry.games = data.games;
        } else {
            dbContent.push({
                date: data.date,
                games: data.games,
                reservations: []
            });
        }
    } else if (data.date && data.game && data.user) {
        // Ajouter une réservation pour une date et un jeu
        let dateEntry = dbContent.find(entry => entry.date === data.date);
        if (!dateEntry) {
            res.status(400).send('Date not found');
            return;
        }
        if (!dateEntry.reservations) {
            dateEntry.reservations = [];
        }
        let gameReservation = dateEntry.reservations.find(r => r.game === data.game);
        if (gameReservation) {
            gameReservation.users.push(data.user);
        } else {
            dateEntry.reservations.push({
                game: data.game,
                users: [data.user]
            });
        }
    } else {
        res.status(400).send('Invalid data format');
        return;
    }

    // Écrire le contenu mis à jour à db.json et pousser à GitHub
    const updateSuccess = await updateGithub(dbContent);
    if (updateSuccess) {
        res.send('Updated successfully');
    } else {
        res.status(500).send('Failed to update db.json');
    }
}
