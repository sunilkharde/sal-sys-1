import { executeQuery } from '../db.js';
import fs from 'fs';
import { join } from 'path';

class xController {

    static updateImageRecords = async (req, res, startDate, endDate) => {

        const publicFolderPath = join(process.cwd(), 'public');

        try {
            const selectQuery = `
                SELECT a.emp_id, DATE_FORMAT(a.loc_date, '%Y-%m-%d %H.%i.%s') as loc_date, 
                CONCAT('/userData/B_', a.emp_id, '_', DATE_FORMAT(a.loc_date, '%Y-%m-%d %H.%i.%s'), '.jpeg') as loc_img 
                FROM dsr_loc as a, employees as b, designations as c 
                WHERE a.emp_id=b.emp_id and b.desg_id=c.desg_id and c.desg_id in (2,3,4,5,6,7) 
                and a.loc_date BETWEEN ? AND ? 
            `;
            const records = await executeQuery(selectQuery, [startDate, endDate]);
            
            for (const record of records) {
                const imageFileName = `${record.loc_img}`;
                const imagePath = join(publicFolderPath, imageFileName);
                if (fs.existsSync(imagePath)) {
                    console.log('Found Odometer Image...', imagePath)
                    const updateQuery = `
                        UPDATE dsr_loc
                        SET has_img2 = 1
                        WHERE emp_id = ? AND loc_date = ?
                    `;
                    await executeQuery(updateQuery, [record.emp_id, record.loc_date]);

                    console.log(`Record updated: emp_id=${record.emp_id}, loc_date=${record.loc_date}`);
                }
            }

            console.log('Odometer image records updated successfully...!')

            res.status(200).json({ message: 'Odometer image records updated successfully...!' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'An error occurred while updating records' });
        }
    };

}

export default xController;